package com.meshvpn.app.vpn

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.ByteBuffer
import java.nio.channels.DatagramChannel
import javax.net.ssl.SSLSocketFactory
import kotlin.concurrent.thread

class MeshVpnService : VpnService() {
    companion object {
        const val TAG = "MeshVPN"
        const val ACTION_START = "START"
        const val ACTION_STOP = "STOP"
        const val EXTRA_CONFIG = "config"
        const val EXTRA_SERVER_IP = "server_ip"
        const val EXTRA_SERVER_PORT = "server_port"

        var isConnected = false
            private set
        var currentServerIP = ""
            private set

        fun start(context: Context, ovpnConfig: String, serverIP: String, port: Int = 443) {
            val intent = Intent(context, MeshVpnService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_CONFIG, ovpnConfig)
                putExtra(EXTRA_SERVER_IP, serverIP)
                putExtra(EXTRA_SERVER_PORT, port)
            }
            context.startService(intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, MeshVpnService::class.java).apply {
                action = ACTION_STOP
            }
            context.startService(intent)
        }
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private var vpnThread: Thread? = null
    private var running = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val config = intent.getStringExtra(EXTRA_CONFIG) ?: ""
                val serverIP = intent.getStringExtra(EXTRA_SERVER_IP) ?: ""
                val port = intent.getIntExtra(EXTRA_SERVER_PORT, 443)
                startVpn(config, serverIP, port)
            }
            ACTION_STOP -> stopVpn()
        }
        return START_STICKY
    }

    private fun startVpn(ovpnConfig: String, serverIP: String, port: Int) {
        if (running) return

        Log.i(TAG, "Starting VPN to $serverIP:$port")

        // Save .ovpn config to file
        val configFile = File(filesDir, "current.ovpn")
        configFile.writeText(ovpnConfig)

        // Parse config for VPN parameters
        val vpnAddress = parseAddress(ovpnConfig) ?: "10.8.0.2"
        val vpnDns = parseDns(ovpnConfig) ?: "8.8.8.8"

        try {
            // Build VPN interface
            val builder = Builder()
                .setSession("MeshVPN - $serverIP")
                .addAddress(vpnAddress, 24)
                .addRoute("0.0.0.0", 0)
                .addDnsServer(vpnDns)
                .addDnsServer("8.8.4.4")
                .setMtu(1400)
                .setBlocking(true)

            // Exclude VPN server itself from tunnel
            try { builder.addDisallowedApplication(packageName) } catch (_: Exception) {}

            vpnInterface = builder.establish()

            if (vpnInterface == null) {
                Log.e(TAG, "Failed to establish VPN interface")
                stopVpn()
                return
            }

            running = true
            isConnected = true
            currentServerIP = serverIP

            // Start tunnel thread
            vpnThread = thread(name = "MeshVPN-Tunnel") {
                runTunnel(serverIP, port, ovpnConfig)
            }

            Log.i(TAG, "VPN connected to $serverIP")

        } catch (e: Exception) {
            Log.e(TAG, "Failed to start VPN", e)
            stopVpn()
        }
    }

    private fun runTunnel(serverIP: String, port: Int, config: String) {
        try {
            // Connect to VPN server via SSL/TLS (OpenVPN over TCP/443)
            val socket = Socket()
            protect(socket) // Bypass VPN for this socket

            socket.connect(InetSocketAddress(serverIP, port), 10000)
            socket.soTimeout = 0

            val sslFactory = SSLSocketFactory.getDefault() as SSLSocketFactory
            val sslSocket = sslFactory.createSocket(socket, serverIP, port, true)

            val input = sslSocket.inputStream
            val output = sslSocket.outputStream
            val vpnInput = java.io.FileInputStream(vpnInterface!!.fileDescriptor)
            val vpnOutput = java.io.FileOutputStream(vpnInterface!!.fileDescriptor)

            // OpenVPN handshake (simplified)
            // In production, use ics-openvpn library for full protocol support
            val resetPacket = buildOpenVpnReset()
            output.write(resetPacket)
            output.flush()

            val buffer = ByteArray(32767)

            // Bidirectional forwarding
            val readThread = thread(name = "VPN-Read") {
                try {
                    while (running) {
                        val len = vpnInput.read(buffer)
                        if (len > 0) {
                            // Wrap in OpenVPN data packet
                            val header = ByteBuffer.allocate(2)
                            header.putShort(len.toShort())
                            output.write(header.array())
                            output.write(buffer, 0, len)
                            output.flush()
                        }
                    }
                } catch (e: Exception) {
                    if (running) Log.e(TAG, "VPN read error", e)
                }
            }

            // Read from server, write to VPN
            try {
                while (running) {
                    val lenBytes = ByteArray(2)
                    var read = input.read(lenBytes)
                    if (read < 2) break

                    val packetLen = ByteBuffer.wrap(lenBytes).short.toInt() and 0xFFFF
                    if (packetLen > buffer.size) break

                    var totalRead = 0
                    while (totalRead < packetLen) {
                        read = input.read(buffer, totalRead, packetLen - totalRead)
                        if (read < 0) break
                        totalRead += read
                    }

                    if (totalRead == packetLen) {
                        vpnOutput.write(buffer, 0, packetLen)
                    }
                }
            } catch (e: Exception) {
                if (running) Log.e(TAG, "Server read error", e)
            }

            readThread.interrupt()
            sslSocket.close()
            socket.close()

        } catch (e: Exception) {
            Log.e(TAG, "Tunnel error", e)
        } finally {
            if (running) stopVpn()
        }
    }

    private fun buildOpenVpnReset(): ByteArray {
        // OpenVPN P_CONTROL_HARD_RESET_CLIENT_V2 packet
        val opcode = 0x38.toByte() // (7 << 3) | 0 = HARD_RESET_V2
        val sessionId = ByteArray(8).also { java.security.SecureRandom().nextBytes(it) }
        val packetId = ByteArray(4) // 0x00000000
        val ackLen = byteArrayOf(0x00)

        val payload = byteArrayOf(opcode) + sessionId + ackLen + packetId
        val header = ByteBuffer.allocate(2).putShort(payload.size.toShort()).array()

        return header + payload
    }

    private fun parseAddress(config: String): String? {
        val regex = Regex("""ifconfig\s+(\d+\.\d+\.\d+\.\d+)""")
        return regex.find(config)?.groupValues?.get(1)
    }

    private fun parseDns(config: String): String? {
        val regex = Regex("""dhcp-option\s+DNS\s+(\d+\.\d+\.\d+\.\d+)""")
        return regex.find(config)?.groupValues?.get(1)
    }

    private fun stopVpn() {
        running = false
        isConnected = false
        currentServerIP = ""
        vpnThread?.interrupt()
        vpnThread = null
        vpnInterface?.close()
        vpnInterface = null
        stopSelf()
        Log.i(TAG, "VPN disconnected")
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    override fun onRevoke() {
        stopVpn()
        super.onRevoke()
    }
}

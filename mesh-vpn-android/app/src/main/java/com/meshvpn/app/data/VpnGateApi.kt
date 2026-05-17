package com.meshvpn.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.URL
import android.util.Base64

object VpnGateApi {
    private const val API_URL = "https://www.vpngate.net/api/iphone/"

    suspend fun fetchServers(): List<VpnServer> = withContext(Dispatchers.IO) {
        try {
            val response = URL(API_URL).readText()
            parseCSV(response)
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    private fun parseCSV(csv: String): List<VpnServer> {
        val lines = csv.split("\n").drop(2) // skip header lines
        return lines.mapNotNull { line ->
            try {
                val cols = line.split(",")
                if (cols.size < 15) return@mapNotNull null
                if (cols[0] == "*") return@mapNotNull null

                VpnServer(
                    hostName = cols[0],
                    ip = cols[1],
                    score = cols[2].toIntOrNull() ?: 0,
                    ping = cols[3].toIntOrNull() ?: 999,
                    speed = cols[4].toLongOrNull() ?: 0,
                    countryShort = cols[6],
                    countryLong = cols[5],
                    numSessions = cols[7].toIntOrNull() ?: 0,
                    uptime = cols[8].toLongOrNull() ?: 0,
                    totalUsers = cols[9].toIntOrNull() ?: 0,
                    totalTraffic = cols[10].toLongOrNull() ?: 0,
                    logType = cols[11],
                    operator = cols[12],
                    message = cols[13],
                    ovpnConfig = try {
                        String(Base64.decode(cols[14], Base64.DEFAULT))
                    } catch (e: Exception) { "" }
                )
            } catch (e: Exception) {
                null
            }
        }.filter { it.ping < 500 && it.ovpnConfig.isNotEmpty() }
            .sortedBy { it.ping }
    }
}

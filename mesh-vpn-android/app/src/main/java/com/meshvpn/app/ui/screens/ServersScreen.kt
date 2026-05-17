package com.meshvpn.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.meshvpn.app.data.VpnGateApi
import com.meshvpn.app.data.VpnServer
import kotlinx.coroutines.launch
@Composable
fun ServersScreen(navController: NavController) {
    var servers by remember { mutableStateOf<List<VpnServer>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        scope.launch {
            servers = VpnGateApi.fetchServers().take(30)
            loading = false
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        TextButton(onClick = { navController.popBackStack() }) {
            Text("← Назад", color = MaterialTheme.colorScheme.primary)
        }

        Text(
            "Бесплатные серверы",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 12.dp)
        )

        Text(
            "Серверы VPN Gate (Университет Цукуба)",
            fontSize = 13.sp,
            color = Color(0xFF8899A6),
            modifier = Modifier.padding(bottom = 16.dp)
        )

        if (loading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
            }
        } else {
            LazyColumn {
                items(servers) { server ->
                    ServerItem(server)
                }
            }
        }
    }
}

@Composable
fun ServerItem(server: VpnServer) {
    var connecting by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "${server.countryLong}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 15.sp
                )
                Text(
                    "${server.ip} • ${server.numSessions} sessions",
                    fontSize = 12.sp,
                    color = Color(0xFF8899A6)
                )
                val speedMbps = server.speed / 1_000_000
                Text(
                    "${speedMbps} Mbps",
                    fontSize = 12.sp,
                    color = Color(0xFF8899A6)
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    "${server.ping}ms",
                    color = Color(0xFF4CAF50),
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(6.dp))
                Button(
                    onClick = {
                        connecting = true
                        val intent = android.net.VpnService.prepare(context)
                        if (intent != null) {
                            (context as? android.app.Activity)?.startActivityForResult(intent, 100)
                        } else {
                            com.meshvpn.app.vpn.MeshVpnService.start(
                                context, server.ovpnConfig, server.ip, 443
                            )
                        }
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (com.meshvpn.app.vpn.MeshVpnService.isConnected &&
                            com.meshvpn.app.vpn.MeshVpnService.currentServerIP == server.ip)
                            Color(0xFF4CAF50) else MaterialTheme.colorScheme.primary
                    ),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        if (com.meshvpn.app.vpn.MeshVpnService.isConnected &&
                            com.meshvpn.app.vpn.MeshVpnService.currentServerIP == server.ip)
                            "Connected" else "Connect",
                        fontSize = 12.sp,
                        color = Color.Black
                    )
                }
            }
        }
    }
}

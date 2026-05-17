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
                    "${server.ip} • ${server.numSessions} сессий",
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
                Text(
                    server.countryShort,
                    fontSize = 12.sp,
                    color = Color(0xFF8899A6)
                )
            }
        }
    }
}

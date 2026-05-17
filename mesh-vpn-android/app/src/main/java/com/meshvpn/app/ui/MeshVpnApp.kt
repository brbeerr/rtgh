package com.meshvpn.app.ui

import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.meshvpn.app.ui.screens.*

@Composable
fun MeshVpnApp() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "home") {
        composable("home") { HomeScreen(navController) }
        composable("servers") { ServersScreen(navController) }
        composable("create") { CreateRoomScreen(navController) }
        composable("join") { JoinRoomScreen(navController) }
        composable("room/{key}") { backStackEntry ->
            val key = backStackEntry.arguments?.getString("key") ?: ""
            RoomScreen(navController, key)
        }
    }
}

package com.meshvpn.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.meshvpn.app.data.RoomManager

@Composable
fun CreateRoomScreen(navController: NavController) {
    var roomName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var maxUsers by remember { mutableStateOf("10") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        TextButton(onClick = { navController.popBackStack() }) {
            Text("← Назад", color = MaterialTheme.colorScheme.primary)
        }

        Text(
            "Создать комнату",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 12.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = roomName,
            onValueChange = { roomName = it.take(30) },
            label = { Text("Название комнаты") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it.take(20) },
            label = { Text("Ваш никнейм") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = maxUsers,
            onValueChange = { maxUsers = it.filter { c -> c.isDigit() }.take(2) },
            label = { Text("Макс. участников") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                if (roomName.isNotBlank() && username.isNotBlank()) {
                    val max = maxUsers.toIntOrNull() ?: 10
                    val room = RoomManager.createRoom(roomName, username, "auto", max)
                    navController.navigate("room/${room.key}") {
                        popUpTo("home")
                    }
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
        ) {
            Text("Создать", fontSize = 16.sp, color = Color.Black)
        }
    }
}

package com.meshvpn.app.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.meshvpn.app.data.RoomManager

@Composable
fun JoinRoomScreen(navController: NavController) {
    var key by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        TextButton(onClick = { navController.popBackStack() }) {
            Text("← Назад", color = MaterialTheme.colorScheme.primary)
        }

        Text(
            "Войти в комнату",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 12.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = key,
            onValueChange = { key = it.uppercase().take(8) },
            label = { Text("Ключ комнаты (8 символов)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(
                textAlign = TextAlign.Center,
                fontSize = 22.sp,
                letterSpacing = 4.sp
            )
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = username,
            onValueChange = { username = it.take(20) },
            label = { Text("Ваш никнейм") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )

        if (error.isNotEmpty()) {
            Text(
                error,
                color = MaterialTheme.colorScheme.error,
                fontSize = 14.sp,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = {
                if (key.length != 8) { error = "Ключ должен быть 8 символов"; return@Button }
                if (username.isBlank()) { error = "Введите никнейм"; return@Button }

                val room = RoomManager.joinRoom(key, username)
                if (room != null) {
                    navController.navigate("room/${room.key}") {
                        popUpTo("home")
                    }
                } else {
                    error = "Комната не найдена или заполнена"
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
        ) {
            Text("Подключиться", fontSize = 16.sp, color = Color.Black)
        }
    }
}

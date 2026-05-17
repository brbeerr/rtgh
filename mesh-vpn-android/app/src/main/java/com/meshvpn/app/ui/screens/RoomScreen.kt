package com.meshvpn.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.meshvpn.app.data.ChatMessage
import com.meshvpn.app.data.RoomManager
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun RoomScreen(navController: NavController, key: String) {
    var room by remember { mutableStateOf(RoomManager.getRoom(key)) }
    var messageText by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(0) }
    val clipboardManager = LocalClipboardManager.current
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    if (room == null) {
        navController.popBackStack()
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(room!!.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Text(
                    "Ключ: $key",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.clickable {
                        clipboardManager.setText(AnnotatedString(key))
                    }
                )
            }
            Button(
                onClick = {
                    RoomManager.leaveRoom(key)
                    navController.navigate("home") { popUpTo("home") { inclusive = true } }
                },
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text("Выйти", fontSize = 13.sp)
            }
        }

        // Tabs
        TabRow(selectedTabIndex = selectedTab) {
            Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                Text("Чат", modifier = Modifier.padding(12.dp))
            }
            Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                Text("Участники (${room!!.members.size})", modifier = Modifier.padding(12.dp))
            }
        }

        when (selectedTab) {
            0 -> {
                // Chat
                Column(modifier = Modifier.weight(1f)) {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.weight(1f).padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        items(room!!.messages) { msg ->
                            MessageBubble(msg)
                        }
                    }

                    // Input
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = messageText,
                            onValueChange = { messageText = it.take(500) },
                            modifier = Modifier.weight(1f),
                            placeholder = { Text("Сообщение...") },
                            singleLine = true,
                            shape = RoundedCornerShape(20.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (messageText.isNotBlank()) {
                                    RoomManager.sendMessage(key, messageText)
                                    messageText = ""
                                    room = RoomManager.getRoom(key)
                                    scope.launch {
                                        listState.animateScrollToItem(room!!.messages.size - 1)
                                    }
                                }
                            },
                            shape = CircleShape,
                            contentPadding = PaddingValues(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                        ) {
                            Text("▶", color = Color.Black)
                        }
                    }
                }
            }
            1 -> {
                // Members
                LazyColumn(modifier = Modifier.padding(12.dp)) {
                    items(room!!.members) { member ->
                        Card(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
                        ) {
                            Row(
                                modifier = Modifier.padding(14.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                        .background(MaterialTheme.colorScheme.primary),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        member.username.first().uppercase(),
                                        color = Color.Black,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column(modifier = Modifier.weight(1f)) {
                                    val isMe = member.userId == RoomManager.getLocalUserId()
                                    Text(
                                        "${member.username}${if (isMe) " (вы)" else ""}",
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Text(
                                        member.virtualIP,
                                        fontSize = 13.sp,
                                        color = Color(0xFF8899A6),
                                        fontFamily = FontFamily.Monospace
                                    )
                                }
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF4CAF50))
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun MessageBubble(msg: ChatMessage) {
    val isSystem = msg.type == "system"
    val isMine = msg.userId == RoomManager.getLocalUserId()
    val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    if (isSystem) {
        Text(
            msg.text,
            fontSize = 13.sp,
            color = Color(0xFF8899A6),
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 6.dp)
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                .padding(8.dp)
        )
    } else {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp),
            horizontalAlignment = if (isMine) Alignment.End else Alignment.Start
        ) {
            Box(
                modifier = Modifier
                    .widthIn(max = 280.dp)
                    .background(
                        if (isMine) Color(0xFF00A888) else MaterialTheme.colorScheme.surface,
                        RoundedCornerShape(12.dp)
                    )
                    .padding(10.dp)
            ) {
                Column {
                    if (!isMine) {
                        Text(msg.username ?: "", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                    }
                    Text(msg.text, color = if (isMine) Color.White else MaterialTheme.colorScheme.onSurface)
                    Text(
                        timeFormat.format(Date(msg.time)),
                        fontSize = 11.sp,
                        color = Color(0xFF8899A6),
                        textAlign = TextAlign.End,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

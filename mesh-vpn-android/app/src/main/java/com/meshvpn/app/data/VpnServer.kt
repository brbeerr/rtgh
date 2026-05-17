package com.meshvpn.app.data

data class VpnServer(
    val hostName: String,
    val ip: String,
    val score: Int,
    val ping: Int,
    val speed: Long,
    val countryShort: String,
    val countryLong: String,
    val numSessions: Int,
    val uptime: Long,
    val totalUsers: Int,
    val totalTraffic: Long,
    val logType: String,
    val operator: String,
    val message: String,
    val ovpnConfig: String
)

data class Room(
    val key: String,
    val name: String,
    val serverId: String,
    val maxUsers: Int,
    val members: List<RoomMember>,
    val messages: List<ChatMessage>
)

data class RoomMember(
    val userId: String,
    val username: String,
    val virtualIP: String,
    val online: Boolean = true
)

data class ChatMessage(
    val id: Int,
    val type: String, // "system" or "user"
    val userId: String? = null,
    val username: String? = null,
    val text: String,
    val time: Long
)

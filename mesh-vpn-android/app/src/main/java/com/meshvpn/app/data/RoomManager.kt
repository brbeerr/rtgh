package com.meshvpn.app.data

import kotlin.random.Random

object RoomManager {
    private val rooms = mutableMapOf<String, Room>()
    private var localUserId: String? = null
    private var localUsername: String? = null

    fun generateKey(): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return (1..8).map { chars[Random.nextInt(chars.length)] }.joinToString("")
    }

    fun generateUserId(): String {
        return (1..16).map { ('a'..'f').random() }.joinToString("") +
            System.currentTimeMillis().toString(16)
    }

    fun generateVirtualIP(index: Int): String {
        return "192.168.${Random.nextInt(1, 255)}.${index + 1}"
    }

    fun getLocalUserId() = localUserId
    fun getLocalUsername() = localUsername

    fun createRoom(name: String, username: String, serverId: String, maxUsers: Int): Room {
        val key = generateKey()
        val userId = generateUserId()
        localUserId = userId
        localUsername = username

        val member = RoomMember(
            userId = userId,
            username = username,
            virtualIP = generateVirtualIP(0)
        )

        val room = Room(
            key = key,
            name = name,
            serverId = serverId,
            maxUsers = maxUsers,
            members = listOf(member),
            messages = listOf(
                ChatMessage(
                    id = 1,
                    type = "system",
                    text = "Комната \"$name\" создана. Ключ: $key",
                    time = System.currentTimeMillis()
                )
            )
        )

        rooms[key] = room
        return room
    }

    fun joinRoom(key: String, username: String): Room? {
        val room = rooms[key] ?: return null
        if (room.members.size >= room.maxUsers) return null

        val userId = generateUserId()
        localUserId = userId
        localUsername = username

        val member = RoomMember(
            userId = userId,
            username = username,
            virtualIP = generateVirtualIP(room.members.size)
        )

        val updatedRoom = room.copy(
            members = room.members + member,
            messages = room.messages + ChatMessage(
                id = room.messages.size + 1,
                type = "system",
                text = "$username присоединился к комнате",
                time = System.currentTimeMillis()
            )
        )

        rooms[key] = updatedRoom
        return updatedRoom
    }

    fun sendMessage(key: String, text: String): ChatMessage? {
        val room = rooms[key] ?: return null
        val msg = ChatMessage(
            id = room.messages.size + 1,
            type = "user",
            userId = localUserId,
            username = localUsername,
            text = text,
            time = System.currentTimeMillis()
        )
        rooms[key] = room.copy(messages = room.messages + msg)
        return msg
    }

    fun getRoom(key: String): Room? = rooms[key]

    fun leaveRoom(key: String) {
        val room = rooms[key] ?: return
        val updatedMembers = room.members.filter { it.userId != localUserId }

        if (updatedMembers.isEmpty()) {
            rooms.remove(key)
        } else {
            rooms[key] = room.copy(
                members = updatedMembers,
                messages = room.messages + ChatMessage(
                    id = room.messages.size + 1,
                    type = "system",
                    text = "${localUsername ?: "Участник"} покинул комнату",
                    time = System.currentTimeMillis()
                )
            )
        }
        localUserId = null
        localUsername = null
    }
}

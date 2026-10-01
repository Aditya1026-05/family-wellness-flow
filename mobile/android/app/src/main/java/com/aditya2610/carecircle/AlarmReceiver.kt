package com.aditya2610.carecircle

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import androidx.core.content.ContextCompat
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL

class AlarmReceiver : BroadcastReceiver() {

    companion object {
        const val ACTION_TRIGGER_ALARM = "com.aditya2610.carecircle.ACTION_TRIGGER_ALARM"
        const val ACTION_DISMISS_ALARM = "com.aditya2610.carecircle.ACTION_DISMISS_ALARM"
        const val ACTION_COMPLETE_ALARM = "com.aditya2610.carecircle.ACTION_COMPLETE_ALARM"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        if (action == ACTION_DISMISS_ALARM) {
            AlarmService.stopAlarm(context)
            return
        }

        if (action == ACTION_COMPLETE_ALARM) {
            AlarmService.stopAlarm(context)
            val taskId = intent.getStringExtra("task_id")
            if (!taskId.isNullOrEmpty()) {
                val baseId = taskId.replace(Regex("_(15|30)$"), "")
                cancelEscalationAlarms(context, baseId)
                completeTaskOnBackend(baseId)
            }
            return
        }

        if (action == ACTION_TRIGGER_ALARM || action == Intent.ACTION_BOOT_COMPLETED) {
            val rawTaskId = intent.getStringExtra("task_id") ?: "urgent_task"
            val baseTaskId = rawTaskId.replace(Regex("_(15|30)$"), "")

            val prefs = context.getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
            val deletedIds = prefs.getStringSet("deleted_ids", emptySet()) ?: emptySet()
            if (deletedIds.contains(rawTaskId) || deletedIds.contains(baseTaskId)) {
                // Task was deleted or cancelled. Immediately purge and do not perform any action!
                cancelEscalationAlarms(context, baseTaskId)
                return
            }

            val scheduledIds = prefs.getStringSet("scheduled_ids", null)
            if (scheduledIds != null && !scheduledIds.contains(rawTaskId) && !scheduledIds.contains(baseTaskId)) {
                // Task is no longer in scheduled list. Do not perform any action!
                cancelEscalationAlarms(context, baseTaskId)
                return
            }

            val pendingResult = goAsync()
            Thread {
                try {
                    var isInvalidOrDeleted = false
                    val checkUrls = listOf(
                        "http://127.0.0.1:8001/api/v1/tasks/$baseTaskId",
                        "http://127.0.0.1:8001/api/v1/task-instances/$baseTaskId"
                    )

                    for (checkUrl in checkUrls) {
                        try {
                            val url = URL(checkUrl)
                            val conn = url.openConnection() as HttpURLConnection
                            conn.requestMethod = "GET"
                            conn.connectTimeout = 1500
                            conn.readTimeout = 1500
                            val code = conn.responseCode
                            if (code == 404) {
                                isInvalidOrDeleted = true
                                conn.disconnect()
                                break
                            } else if (code in 200..299) {
                                val body = conn.inputStream.bufferedReader().use { it.readText() }
                                conn.disconnect()
                                if (body.contains("\"status\":\"completed\"") || body.contains("\"status\":\"missed\"")) {
                                    isInvalidOrDeleted = true
                                    break
                                }
                            }
                        } catch (e: Exception) {
                            // Offline or unreachable - fall back to shared preferences
                        }
                    }

                    if (isInvalidOrDeleted) {
                        val editPrefs = context.getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
                        val delSet = editPrefs.getStringSet("deleted_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
                        delSet.add(rawTaskId)
                        delSet.add(baseTaskId)
                        editPrefs.edit().putStringSet("deleted_ids", delSet).apply()
                        cancelEscalationAlarms(context, baseTaskId)
                        return@Thread
                    }

                    val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
                    @Suppress("DEPRECATION")
                    val wakeLock = powerManager?.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                        "CareCircle:AlarmReceiverWakeLock"
                    )
                    wakeLock?.acquire(60000)

                    @Suppress("DEPRECATION")
                    val screenLock = powerManager?.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
                        "CareCircle:AlarmReceiverScreenWake"
                    )
                    screenLock?.acquire(30000)

                    val taskTitle = intent.getStringExtra("task_title") ?: "Care Routine"
                    val taskBody = intent.getStringExtra("task_body") ?: "Time for your scheduled care action."

                    val serviceIntent = Intent(context, AlarmService::class.java).apply {
                        this.action = AlarmService.ACTION_START_ALARM
                        putExtra("task_id", rawTaskId)
                        putExtra("task_title", taskTitle)
                        putExtra("task_body", taskBody)
                    }

                    ContextCompat.startForegroundService(context, serviceIntent)

                    // Notify React Native runtime if active
                    AlarmRingtoneModule.sendAlarmEvent(rawTaskId, taskTitle, taskBody)

                    // Launch full-screen native alarm activity over lock screen
                    try {
                        val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                            putExtra("alarm_task_id", rawTaskId)
                            putExtra("alarm_task_title", taskTitle)
                            putExtra("alarm_task_body", taskBody)
                        }
                        context.startActivity(alarmIntent)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                } finally {
                    try {
                        pendingResult.finish()
                    } catch (e: Exception) {
                        // Ignored if already finished
                    }
                }
            }.start()
        }
    }

    private fun cancelEscalationAlarms(context: Context, id: String) {
        try {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val baseId = id.replace(Regex("_(15|30)$"), "")
            val ids = listOf(baseId, "${baseId}_15", "${baseId}_30")
            val prefs = context.getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
            val scheduledSet = prefs.getStringSet("scheduled_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
            val deletedSet = prefs.getStringSet("deleted_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()

            for (currId in ids) {
                val intent = Intent(context, AlarmReceiver::class.java).apply {
                    action = ACTION_TRIGGER_ALARM
                }
                val pi = PendingIntent.getBroadcast(
                    context,
                    currId.hashCode(),
                    intent,
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                )
                if (pi != null) {
                    alarmManager.cancel(pi)
                    pi.cancel()
                }
                scheduledSet.remove(currId)
                deletedSet.add(currId)
            }
            prefs.edit().putStringSet("scheduled_ids", scheduledSet).putStringSet("deleted_ids", deletedSet).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun completeTaskOnBackend(id: String) {
        Thread {
            val endpoints = listOf(
                "http://127.0.0.1:8001/api/v1/tasks/$id/complete",
                "http://127.0.0.1:8001/api/v1/task-instances/$id/complete"
            )
            for (endpoint in endpoints) {
                try {
                    val url = URL(endpoint)
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.connectTimeout = 3000
                    conn.readTimeout = 3000
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.doOutput = true
                    val os: OutputStream = conn.outputStream
                    os.write("{}".toByteArray())
                    os.flush()
                    os.close()
                    val responseCode = conn.responseCode
                    conn.disconnect()
                    if (responseCode in 200..299) {
                        break
                    }
                } catch (e: Exception) {
                    // Ignored on failover
                }
            }
        }.start()
    }
}

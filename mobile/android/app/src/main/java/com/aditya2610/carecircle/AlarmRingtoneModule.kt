package com.aditya2610.carecircle

import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.view.WindowManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmRingtoneModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        var activeInstance: AlarmRingtoneModule? = null

        fun sendAlarmEvent(taskId: String, title: String, body: String) {
            try {
                val ctx = activeInstance?.reactContext ?: return
                if (ctx.hasActiveReactInstance()) {
                    val map = com.facebook.react.bridge.Arguments.createMap().apply {
                        putString("taskId", taskId)
                        putString("title", title)
                        putString("body", body)
                    }
                    ctx.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("CareCircleAlarmTriggered", map)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    init {
        activeInstance = this
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun getName(): String = "AlarmRingtone"

    @ReactMethod
    fun scheduleExactAlarm(id: String, title: String, body: String, triggerAtMillis: Double) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return

            val intent = Intent(reactContext, AlarmReceiver::class.java).apply {
                action = AlarmReceiver.ACTION_TRIGGER_ALARM
                putExtra("task_id", id)
                putExtra("task_title", title)
                putExtra("task_body", body)
            }

            val requestCode = id.hashCode()
            val pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val showIntent = Intent(reactContext, AlarmActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                putExtra("alarm_active", true)
                putExtra("alarm_task_id", id)
                putExtra("alarm_task_title", title)
                putExtra("alarm_task_body", body)
            }
            val showPendingIntent = PendingIntent.getActivity(
                reactContext,
                requestCode,
                showIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(triggerAtMillis.toLong(), showPendingIntent),
                    pendingIntent
                )
            } else {
                @Suppress("DEPRECATION")
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis.toLong(), pendingIntent)
            }

            // Track scheduled ID and ensure not marked deleted
            val baseId = id.replace(Regex("_(15|30)$"), "")
            val prefs = reactContext.getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
            val set = prefs.getStringSet("scheduled_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
            val delSet = prefs.getStringSet("deleted_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
            delSet.remove(id)
            delSet.remove(baseId)
            set.add(id)
            prefs.edit().putStringSet("scheduled_ids", set).putStringSet("deleted_ids", delSet).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun cancelAlarm(id: String) {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return
            val baseId = id.replace(Regex("_(15|30)$"), "")
            val idsToCancel = listOf(baseId, "${baseId}_15", "${baseId}_30")
            val prefs = reactContext.getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
            val set = prefs.getStringSet("scheduled_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
            val delSet = prefs.getStringSet("deleted_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()

            for (currId in idsToCancel) {
                val intent = Intent(reactContext, AlarmReceiver::class.java).apply {
                    action = AlarmReceiver.ACTION_TRIGGER_ALARM
                }
                val requestCode = currId.hashCode()
                val pendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                )
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent)
                    pendingIntent.cancel()
                }
                set.remove(currId)
                delSet.add(currId)
            }
            prefs.edit().putStringSet("scheduled_ids", set).putStringSet("deleted_ids", delSet).apply()
            AlarmService.stopAlarm(reactContext)
            reactContext.sendBroadcast(Intent(AlarmReceiver.ACTION_DISMISS_ALARM))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun recordDeletedTask(id: String) {
        cancelAlarm(id)
    }

    @ReactMethod
    fun cancelAllScheduledAlarms() {
        try {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return
            val prefs = reactContext.getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
            val ids = prefs.getStringSet("scheduled_ids", HashSet<String>()) ?: emptySet()
            for (id in ids) {
                val intent = Intent(reactContext, AlarmReceiver::class.java).apply {
                    action = AlarmReceiver.ACTION_TRIGGER_ALARM
                }
                val requestCode = id.hashCode()
                val pendingIntent = PendingIntent.getBroadcast(
                    reactContext,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
                )
                if (pendingIntent != null) {
                    alarmManager.cancel(pendingIntent)
                    pendingIntent.cancel()
                }
            }
            prefs.edit().clear().apply()
            AlarmService.stopAlarm(reactContext)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun playAlarm() {
        try {
            val serviceIntent = Intent(reactContext, AlarmService::class.java).apply {
                action = AlarmService.ACTION_START_ALARM
                putExtra("task_id", "test_alarm")
                putExtra("task_title", "CareCircle Urgent Alarm")
                putExtra("task_body", "Scheduled care action is due now.")
            }
            ContextCompat.startForegroundService(reactContext, serviceIntent)
            wakeScreen()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun stopAlarm() {
        try {
            AlarmService.stopAlarm(reactContext)
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
            wakeLock = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun wakeScreen() {
        try {
            val powerManager = reactContext.getSystemService(Context.POWER_SERVICE) as? PowerManager
            if (powerManager != null) {
                if (wakeLock?.isHeld == true) {
                    wakeLock?.release()
                }
                @Suppress("DEPRECATION")
                val flags = PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE
                wakeLock = powerManager.newWakeLock(flags, "CareCircle:AlarmRingtoneWakeLock")
                wakeLock?.acquire(60000)
            }

            val activity: Activity? = reactContext.currentActivity
            if (activity != null) {
                activity.runOnUiThread {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                        activity.setShowWhenLocked(true)
                        activity.setTurnScreenOn(true)
                    }
                    activity.window.addFlags(
                        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                    )
                }
            } else {
                val launchIntent = reactContext.packageManager.getLaunchIntentForPackage(reactContext.packageName)
                if (launchIntent != null) {
                    launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                    reactContext.startActivity(launchIntent)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}

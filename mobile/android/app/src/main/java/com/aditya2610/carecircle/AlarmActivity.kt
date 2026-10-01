package com.aditya2610.carecircle

import android.app.Activity
import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AlarmActivity : Activity() {

    private var taskId: String? = null
    private var stopAlarmReceiver: BroadcastReceiver? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        taskId = intent.getStringExtra("alarm_task_id")
        val rawId = taskId ?: ""
        val baseId = rawId.replace(Regex("_(15|30)$"), "")

        val prefs = getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
        val deletedIds = prefs.getStringSet("deleted_ids", emptySet()) ?: emptySet()
        if (deletedIds.contains(rawId) || deletedIds.contains(baseId)) {
            // Task is deleted or cancelled. Immediately dismiss and exit!
            AlarmService.stopAlarm(this)
            finish()
            return
        }

        configureLockScreen()

        val taskTitle = intent.getStringExtra("alarm_task_title") ?: "Scheduled Care Action"
        val taskBody = intent.getStringExtra("alarm_task_body") ?: "Time for your scheduled care routine."

        buildLayout(taskTitle, taskBody)
        registerStopReceiver()
    }

    private fun configureLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        )
    }

    private fun registerStopReceiver() {
        stopAlarmReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                finish()
            }
        }
        val filter = IntentFilter().apply {
            addAction(AlarmReceiver.ACTION_DISMISS_ALARM)
            addAction(AlarmReceiver.ACTION_COMPLETE_ALARM)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopAlarmReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(stopAlarmReceiver, filter)
        }
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    private fun buildLayout(taskTitle: String, taskBody: String) {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0F172A")) // Slate 900
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT
            )
            setPadding(dpToPx(24), dpToPx(48), dpToPx(24), dpToPx(36))
            gravity = Gravity.CENTER_HORIZONTAL
        }

        // Header Label
        val headerLabel = TextView(this).apply {
            text = "CARE CIRCLE ALARM"
            setTextColor(Color.parseColor("#94A3B8")) // Slate 400
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                letterSpacing = 0.15f
            }
        }
        root.addView(headerLabel)

        // Time Display
        val timeFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
        val timeLabel = TextView(this).apply {
            text = timeFormat.format(Date())
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 44f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(0, dpToPx(12), 0, dpToPx(24))
        }
        root.addView(timeLabel)

        // Task Detail Card Container
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1E293B")) // Slate 800
                cornerRadius = dpToPx(18).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(dpToPx(20), dpToPx(20), dpToPx(20), dpToPx(24))
        }

        // Category Badge
        val badge = TextView(this).apply {
            text = "CARE ACTION DUE"
            setTextColor(Color.parseColor("#38BDF8")) // Sky 400
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0F2B48"))
                cornerRadius = dpToPx(6).toFloat()
            }
            setPadding(dpToPx(10), dpToPx(4), dpToPx(10), dpToPx(4))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                letterSpacing = 0.1f
            }
        }
        card.addView(badge)

        // Task Title
        val titleView = TextView(this).apply {
            text = taskTitle
            setTextColor(Color.parseColor("#F8FAFC"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            setPadding(0, dpToPx(14), 0, 0)
        }
        card.addView(titleView)

        // Task Body / Notes
        val bodyView = TextView(this).apply {
            text = taskBody
            setTextColor(Color.parseColor("#CBD5E1"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setPadding(0, dpToPx(8), 0, 0)
            setLineSpacing(dpToPx(3).toFloat(), 1f)
        }
        card.addView(bodyView)

        root.addView(card)

        // Flexible Space to push buttons to bottom
        val spacer = View(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }
        root.addView(spacer)

        // Button 1: Complete / Done
        val doneButton = Button(this).apply {
            text = "I'VE DONE THIS"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#10B981")) // Emerald 500
                cornerRadius = dpToPx(14).toFloat()
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dpToPx(58)
            )
            params.bottomMargin = dpToPx(12)
            layoutParams = params
            setOnClickListener {
                handleComplete()
            }
        }
        root.addView(doneButton)

        // Button 2: Dismiss Alarm
        val dismissButton = Button(this).apply {
            text = "DISMISS ALARM"
            setTextColor(Color.parseColor("#CBD5E1")) // Slate 300
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#334155")) // Slate 700
                cornerRadius = dpToPx(14).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dpToPx(50)
            )
            setOnClickListener {
                handleDismiss()
            }
        }
        root.addView(dismissButton)

        setContentView(root)
    }

    private fun handleComplete() {
        AlarmService.stopAlarm(this)
        val id = taskId
        if (!id.isNullOrEmpty()) {
            cancelEscalationAlarms(id)
            completeTaskOnBackend(id)
        }
        finish()
    }

    private fun handleDismiss() {
        AlarmService.stopAlarm(this)
        val id = taskId
        if (!id.isNullOrEmpty()) {
            val baseId = id.replace(Regex("_(15|30)$"), "")
            cancelEscalationAlarms(baseId)
        }
        finish()
    }

    private fun cancelEscalationAlarms(id: String) {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val baseId = id.replace(Regex("_(15|30)$"), "")
            val ids = listOf(baseId, "${baseId}_15", "${baseId}_30")
            val prefs = getSharedPreferences("carecircle_alarms", Context.MODE_PRIVATE)
            val scheduledSet = prefs.getStringSet("scheduled_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()
            val deletedSet = prefs.getStringSet("deleted_ids", HashSet<String>())?.toMutableSet() ?: mutableSetOf()

            for (currId in ids) {
                val intent = Intent(this, AlarmReceiver::class.java).apply {
                    action = AlarmReceiver.ACTION_TRIGGER_ALARM
                }
                val pi = PendingIntent.getBroadcast(
                    this,
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

    override fun onDestroy() {
        try {
            if (stopAlarmReceiver != null) {
                unregisterReceiver(stopAlarmReceiver)
                stopAlarmReceiver = null
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        super.onDestroy()
    }
}

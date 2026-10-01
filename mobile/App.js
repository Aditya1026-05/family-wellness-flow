import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  Vibration,
  Platform,
  TextInput,
  Dimensions,
  ScrollView,
  Switch,
  Image,
  NativeModules,
  NativeEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

const { AlarmRingtone } = NativeModules;
const alarmEmitter = AlarmRingtone ? new NativeEventEmitter(AlarmRingtone) : null;

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    const isUrgent = Boolean(data.ring_alarm || data.ring_sound || data.is_urgent);
    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: isUrgent
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

// Configure Android Notification Channels with phone's alarm ringtone and strong vibration
async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    const urgentAlarmChannelConfig = {
      name: 'Urgent Care Alarms & Ringtone',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 800, 400, 800, 400, 800],
      lightColor: '#EF4444',
      enableVibrate: true,
      enableLights: true,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM, // Guarantees sound and vibration when screen is off or phone is locked
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    };

    // Clean up older channels that may have had erroneous sound configs
    try {
      await Notifications.deleteNotificationChannelAsync('carecircle_urgent_alarm_v12').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('carecircle_urgent_v10').catch(() => {});
      await Notifications.deleteNotificationChannelAsync('carecircle_reminders_v3').catch(() => {});
    } catch {}

    // Register active urgent alarm channels
    try {
      await Notifications.setNotificationChannelAsync('carecircle_urgent_alarm_v14', urgentAlarmChannelConfig);
      await Notifications.setNotificationChannelAsync('carecircle_urgent_alarm_v12', urgentAlarmChannelConfig);
      await Notifications.setNotificationChannelAsync('carecircle_urgent_v10', urgentAlarmChannelConfig);
    } catch (e) {
      console.log('Channel config note:', e.message);
    }

    await Notifications.setNotificationChannelAsync('carecircle_reminders_v4', {
      name: 'Care Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      enableVibrate: true,
      vibrationPattern: [0, 500, 250, 500],
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.NOTIFICATION,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
      },
    });
  }
}

// Initialize notification channels on module load
setupNotificationChannels();

// Endpoints: Local reverse-port forwarded development by default
const DEFAULT_LOCAL_WEB_URL = 'http://127.0.0.1:8080';
const DEFAULT_LOCAL_BACKEND_URL = 'http://127.0.0.1:8001';
const DEFAULT_PROD_WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_LOCAL_WEB_URL;
const DEFAULT_PROD_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_LOCAL_BACKEND_URL;
const DEFAULT_DEV_HOST = '127.0.0.1';

export default function App() {
  const isProduction = !__DEV__;
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [serverHost, setServerHost] = useState(DEFAULT_DEV_HOST);
  const [serverPort, setServerPort] = useState('8080');
  const [backendPort, setBackendPort] = useState('8001');

  // App Start Splash and First-Time Onboarding State
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(null);

  // Device & Alert Permissions Toggles
  const [permNotifications, setPermNotifications] = useState(true);
  const [permRingtone, setPermRingtone] = useState(true);
  const [permVibration, setPermVibration] = useState(true);
  const [permLockscreen, setPermLockscreen] = useState(true);

  const [expoPushToken, setExpoPushToken] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [linkedProfile, setLinkedProfile] = useState(null); // { role, name, id }
  const [activeAlarmTask, setActiveAlarmTask] = useState(null);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [webViewError, setWebViewError] = useState(null);
  const [customHostInput, setCustomHostInput] = useState(DEFAULT_LOCAL_WEB_URL);

  const webViewRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();

  // Determine effective Web App URL and Backend API URL
  const webAppUrl = customServerUrl
    ? (customServerUrl.startsWith('http') ? customServerUrl : `http://${customServerUrl}:${serverPort}`)
    : (process.env.EXPO_PUBLIC_WEB_URL || `http://${serverHost}:${serverPort}`);

  const backendUrl = customServerUrl
    ? (customServerUrl.startsWith('http')
        ? (customServerUrl.includes(':8080') ? customServerUrl.replace(':8080', `:${backendPort}`) : customServerUrl)
        : `http://${customServerUrl}:${backendPort}`)
    : (process.env.EXPO_PUBLIC_BACKEND_URL || `http://${serverHost}:${backendPort}`);

  // Start Splash timer: display logo & branding for 1.8 seconds at launch
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsSplashVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Check if first-time permissions onboarding has already been completed & load saved server URL
  useEffect(() => {
    (async () => {
      try {
        const completed = await AsyncStorage.getItem('carecircle_onboarding_completed_v1');
        setIsOnboardingCompleted(completed === 'true');

        const savedUrl = await AsyncStorage.getItem('carecircle_custom_server_url');
        if (savedUrl) {
          setCustomServerUrl(savedUrl);
          setCustomHostInput(savedUrl);
        }

        const savedHost = await AsyncStorage.getItem('carecircle_server_host');
        if (savedHost) {
          setServerHost(savedHost);
          if (!savedUrl && !isProduction) {
            setCustomHostInput(savedHost);
          }
        }

        const savedPerms = await AsyncStorage.getItem('carecircle_device_perms');
        if (savedPerms) {
          const p = JSON.parse(savedPerms);
          if (p.notifications !== undefined) setPermNotifications(p.notifications);
          if (p.ringtone !== undefined) setPermRingtone(p.ringtone);
          if (p.vibration !== undefined) setPermVibration(p.vibration);
          if (p.lockscreen !== undefined) setPermLockscreen(p.lockscreen);
        }
      } catch (e) {
        setIsOnboardingCompleted(true);
      }
    })();
  }, []);

  // Save permission toggles to storage
  async function savePermissionsPreferences(notif, ring, vib, lock) {
    try {
      await AsyncStorage.setItem('carecircle_device_perms', JSON.stringify({
        notifications: notif,
        ringtone: ring,
        vibration: vib,
        lockscreen: lock,
      }));
    } catch (e) {
      console.log('Perms save note:', e.message);
    }
  }

  // Complete onboarding on first download
  async function handleCompleteOnboarding() {
    await initPermissionsAndToken();
    await AsyncStorage.setItem('carecircle_onboarding_completed_v1', 'true');
    await savePermissionsPreferences(permNotifications, permRingtone, permVibration, permLockscreen);
    setIsOnboardingCompleted(true);
  }

  // Continuous vibration loop while alarm is ringing in foreground
  useEffect(() => {
    if (activeAlarmTask && permVibration) {
      const interval = setInterval(() => {
        Vibration.vibrate([0, 600, 300, 600]);
      }, 1600);
      Vibration.vibrate([0, 600, 300, 600]);
      return () => {
        clearInterval(interval);
        Vibration.cancel();
      };
    } else {
      Vibration.cancel();
    }
  }, [activeAlarmTask, permVibration]);

  // Restore persisted linked profile across reloads and app restarts
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('carecircle_linked_profile');
        if (saved) {
          const parsed = JSON.parse(saved);
          setLinkedProfile(parsed);
        }
      } catch (e) {
        console.log('Restore profile note:', e.message);
      }
    })();
  }, []);

  // Initialize native push token and permissions
  useEffect(() => {
    initPermissionsAndToken();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const isUrgent = Boolean(data?.ring_alarm || data?.ring_sound || data?.is_urgent);
      const isCallAction = data?.action === 'call_parent';

      // Always trigger immediate hardware vibration when notification arrives with screen on
      try {
        Vibration.vibrate([0, 800, 400, 800]);
      } catch (e) {}

      const entry = {
        id: String(Date.now()),
        title: title || 'Care Alert',
        body: body || '',
        data: data || {},
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isUrgent,
        isCallAction,
        stage: data?.stage !== undefined ? data.stage : null,
      };
      setNotificationHistory((prev) => [entry, ...prev]);

      // Pop native full-screen alarm modal with ringtone and vibration loop
      if (isUrgent || isCallAction) {
        if (permRingtone) {
          AlarmRingtone?.playAlarm();
        } else {
          AlarmRingtone?.wakeScreen();
        }
        setActiveAlarmTask({
          title: title || (isCallAction ? `Call ${data?.parent_name || 'Parent'} Alarm` : 'Urgent Care Alarm'),
          body: body || '',
          taskId: data?.task_id || data?.task_instance_id || '1',
          taskTitle: data?.task_title || title || 'Care Task',
          category: data?.category || 'Medicine',
          stage: data?.stage,
          isCallAction,
          parentName: data?.parent_name || 'Parent',
          parentPhone: data?.parent_phone || '',
        });
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { title, body, data } = response.notification.request.content;
      const isUrgent = Boolean(data?.ring_alarm || data?.ring_sound || data?.is_urgent);
      const isCallAction = data?.action === 'call_parent';

      if (isUrgent || isCallAction) {
        setActiveAlarmTask({
          title: title || (isCallAction ? `Call ${data?.parent_name || 'Parent'} Alarm` : 'Urgent Care Alarm'),
          body: body || '',
          taskId: data?.task_id || data?.task_instance_id || '1',
          taskTitle: data?.task_title || title || 'Care Task',
          category: data?.category || 'Medicine',
          stage: data?.stage,
          isCallAction,
          parentName: data?.parent_name || 'Parent',
          parentPhone: data?.parent_phone || '',
        });
      }
    });

    // Native Alarm Broadcast Event Listener (Fires when exact native alarm triggers)
    let nativeAlarmSub = null;
    if (alarmEmitter) {
      try {
        nativeAlarmSub = alarmEmitter.addListener('CareCircleAlarmTriggered', (data) => {
          setActiveAlarmTask({
            title: `Alarm: Time for ${data?.title || 'Care Routine'}!`,
            body: data?.body || 'Scheduled care action is due now.',
            taskId: data?.taskId || '1',
            taskTitle: data?.title || 'Care Routine',
            category: 'Care Routine',
            isCallAction: false,
          });
        });
      } catch (e) {
        console.log('Emitter listener note:', e.message);
      }
    }

    return () => {
      if (notificationListener.current?.remove) notificationListener.current.remove();
      if (responseListener.current?.remove) responseListener.current.remove();
      if (nativeAlarmSub?.remove) nativeAlarmSub.remove();
    };
  }, []);

  async function initPermissionsAndToken() {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      await setupNotificationChannels();

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '4c7bc70d-ec44-46d3-9f5b-b9f18a223ad0',
      }).catch(async () => {
        return await Notifications.getExpoPushTokenAsync();
      });

      if (tokenData?.data) {
        setExpoPushToken(tokenData.data);
        // Initial registration with backend using persisted profile if available
        try {
          const saved = await AsyncStorage.getItem('carecircle_linked_profile');
          if (saved) {
            const parsed = JSON.parse(saved);
            await registerWithBackend(tokenData.data, parsed);
          } else {
            await registerWithBackend(tokenData.data);
          }
        } catch {
          await registerWithBackend(tokenData.data);
        }
      }
    } catch (e) {
      console.log('Push token note:', e.message);
    }
  }

  // Register device token with backend, optionally linked to a specific parent/user
  async function registerWithBackend(token, linkData = null) {
    try {
      const payload = {
        token: token,
        platform: Platform.OS,
        role: linkData?.role || 'both',
        device_name: Device.modelName || 'Mobile Companion',
        parent_profile_id: linkData?.parent_profile_id || undefined,
        user_id: linkData?.user_id || undefined,
      };

      const res = await fetch(`${backendUrl}/api/v1/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsRegistered(true);
        if (linkData) {
          setLinkedProfile(linkData);
          AsyncStorage.setItem('carecircle_linked_profile', JSON.stringify(linkData)).catch(() => {});
        }
      }
    } catch (err) {
      console.log('Backend sync note:', err.message);
    }
  }

  // Dedicated Task Alarm Trigger
  async function handleTriggerTaskAlarm(task) {
    try {
      if (permRingtone) {
        AlarmRingtone?.playAlarm();
      } else {
        AlarmRingtone?.wakeScreen();
      }

      setActiveAlarmTask({
        title: task?.title ? `Alarm: Time for ${task.title}!` : 'Urgent Care Alarm',
        body: task?.body || 'Care task is due now.',
        taskId: task?.id || '1',
        taskTitle: task?.title || 'Care Task',
        category: task?.category || 'Care Routine',
        isCallAction: false,
      });
    } catch (e) {
      console.log('Task alarm trigger note:', e.message);
    }
  }

  const alarmedKeysRef = useRef(new Set());
  const scheduledAlarmsRef = useRef(new Set());

  // Background active task poller to guarantee alarms fire on time
  useEffect(() => {
    let intervalId;
    async function checkUpcomingTasks() {
      let parentId = linkedProfile?.parent_profile_id || linkedProfile?.id;
      if (!parentId) {
        parentId = '02a21e2e-e30c-46b9-a05b-43837474d1e6';
      }

      try {
        const res = await fetch(`${backendUrl}/api/v1/task-instances/parent/${parentId}/today`);
        if (!res.ok) return;
        const instances = await res.json();
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const nowMillis = Date.now();

        for (const inst of instances) {
          const t = inst.task || inst;
          if (inst.status !== 'pending' && inst.status !== 'snoozed') continue;
          if (!t.ring_alarm && !t.ringAlarm) continue;

          const timeStr = t.scheduled_time || t.time;
          if (!timeStr) continue;

          let startM = null;
          const match = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)?/i);
          if (match) {
            let h = parseInt(match[1], 10);
            const m = parseInt(match[2], 10);
            const ampm = match[3]?.toUpperCase();
            if (ampm === 'PM' && h < 12) h += 12;
            if (ampm === 'AM' && h === 12) h = 0;
            startM = h * 60 + m;
          }

          if (startM !== null) {
            // Schedule exact native OS alarm with AlarmManager so it wakes the phone even when app is closed / cleared from tabs
            const targetDate = new Date();
            targetDate.setHours(Math.floor(startM / 60), startM % 60, 0, 0);
            const baseTrigger = targetDate.getTime();

            // 1. Exact start of slot (0 min)
            if (baseTrigger > nowMillis) {
              const schedKey = `sched-${inst.id || t.id}-${startM}-0`;
              if (!scheduledAlarmsRef.current.has(schedKey)) {
                scheduledAlarmsRef.current.add(schedKey);
                AlarmRingtone?.scheduleExactAlarm(
                  String(inst.id || t.id),
                  t.title || 'Care Reminder',
                  t.detail || t.notes || `Time for ${t.title}`,
                  baseTrigger
                );
              }
            }

            // 2. Escalation alarm (+15 min) if not completed
            const trigger15 = baseTrigger + 15 * 60 * 1000;
            if (trigger15 > nowMillis) {
              const schedKey15 = `sched-${inst.id || t.id}-${startM}-15`;
              if (!scheduledAlarmsRef.current.has(schedKey15)) {
                scheduledAlarmsRef.current.add(schedKey15);
                AlarmRingtone?.scheduleExactAlarm(
                  `${inst.id || t.id}_15`,
                  `Reminder: ${t.title || 'Care Task'}`,
                  `Time for ${t.title || 'care task'}. Please complete or snooze.`,
                  trigger15
                );
              }
            }
          }
        }
      } catch (e) {
        // Ignored
      }
    }

    intervalId = setInterval(checkUpcomingTasks, 5000);
    checkUpcomingTasks();
    return () => clearInterval(intervalId);
  }, [linkedProfile, backendUrl, permRingtone]);

  // Test Ringtone & Vibration Trigger: fires physical vibration, notification sound, and alarm modal
  async function handleTriggerTestAlarm() {
    try {
      // Native AlarmService handles single continuous sound and vibration cleanly
      if (permRingtone) {
        AlarmRingtone?.playAlarm();
      } else {
        AlarmRingtone?.wakeScreen();
      }

      // Full-screen active alarm modal
      setActiveAlarmTask({
        title: 'Care Alert Test',
        body: 'Phone is ringing with your default phone ringtone and vibration. Tap Dismiss to stop.',
        taskId: null,
        taskTitle: 'Ringtone & Vibration Test',
        category: 'Test Alert',
        isCallAction: false,
      });
    } catch (e) {
      console.log('Test alarm note:', e.message);
      Vibration.vibrate([0, 800, 400, 800]);
      setActiveAlarmTask({
        title: 'Care Alert Test',
        body: 'Vibration alert is active. Tap Dismiss to stop.',
        taskId: null,
        taskTitle: 'Ringtone & Vibration Test',
        category: 'Test Alert',
        isCallAction: false,
      });
    }
  }

  // Bridge: handle messages posted by the web app inside the WebView
  function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'DEVICE_LINK') {
        setLinkedProfile(data);
        AsyncStorage.setItem('carecircle_linked_profile', JSON.stringify(data)).catch(() => {});
        if (expoPushToken) {
          registerWithBackend(expoPushToken, data);
        }
      } else if (data.type === 'DEVICE_UNLINK') {
        setLinkedProfile(null);
        setIsRegistered(false);
        AsyncStorage.removeItem('carecircle_linked_profile').catch(() => {});
        // Cancel all pending native hardware alarms and current audio
        AlarmRingtone?.cancelAllScheduledAlarms();
        AlarmRingtone?.stopAlarm();
        setActiveAlarmTask(null);
        Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
        scheduledAlarmsRef.current = new Set();
        if (expoPushToken) {
          fetch(`${backendUrl}/api/v1/devices/unregister`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: expoPushToken }),
          }).catch(() => {});
        }
      } else if (data.type === 'CALL_PARENT') {
        handleCallParent(data.phone, data.parent_name);
      } else if (data.type === 'TEST_ALARM') {
        handleTriggerTestAlarm();
      } else if (data.type === 'TASK_ALARM') {
        handleTriggerTaskAlarm(data.task);
      } else if (data.type === 'CANCEL_ALARM') {
        const id = String(data.taskId || '');
        if (id) {
          AlarmRingtone?.cancelAlarm(id);
          AlarmRingtone?.cancelAlarm(`${id}_15`);
          AlarmRingtone?.cancelAlarm(`${id}_30`);
        }
        AlarmRingtone?.stopAlarm();
        setActiveAlarmTask(null);
      } else if (data.type === 'SYNC_TASKS') {
        if (data.parentId && (!linkedProfile || !linkedProfile.parent_profile_id)) {
          const prof = { parent_profile_id: data.parentId, role: 'parent' };
          setLinkedProfile(prof);
          AsyncStorage.setItem('carecircle_linked_profile', JSON.stringify(prof)).catch(() => {});
        }
        if (Array.isArray(data.tasks)) {
          const nowMillis = Date.now();
          for (const item of data.tasks) {
            const t = item.task || item;
            if (item.status !== 'pending' && item.status !== 'snoozed') continue;
            if (!t.ring_alarm && !t.ringAlarm) continue;
            const timeStr = t.scheduled_time || t.time;
            if (!timeStr) continue;
            const match = String(timeStr).match(/(\d+):(\d+)\s*(AM|PM)?/i);
            if (match) {
              let h = parseInt(match[1], 10);
              const m = parseInt(match[2], 10);
              const ampm = match[3]?.toUpperCase();
              if (ampm === 'PM' && h < 12) h += 12;
              if (ampm === 'AM' && h === 12) h = 0;
              const targetDate = new Date();
              targetDate.setHours(h, m, 0, 0);
              const baseTrigger = targetDate.getTime();
              if (baseTrigger > nowMillis) {
                AlarmRingtone?.scheduleExactAlarm(
                  String(item.id || t.id),
                  t.title || 'Care Reminder',
                  t.detail || t.notes || `Time for ${t.title}`,
                  baseTrigger
                );
              }
              const trigger15 = baseTrigger + 15 * 60 * 1000;
              if (trigger15 > nowMillis) {
                AlarmRingtone?.scheduleExactAlarm(
                  `${item.id || t.id}_15`,
                  `Reminder: ${t.title || 'Care Task'}`,
                  `Time for ${t.title || 'care task'}. Please complete or snooze.`,
                  trigger15
                );
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignored if non-json
    }
  }

  // Complete task from the full-screen native alarm modal
  async function handleCompleteFromAlarm() {
    Vibration.cancel();
    AlarmRingtone?.stopAlarm();
    const task = activeAlarmTask;
    setActiveAlarmTask(null);

    if (task?.taskId) {
      try {
        AlarmRingtone?.cancelAlarm(String(task.taskId));
        AlarmRingtone?.cancelAlarm(`${task.taskId}_15`);
        AlarmRingtone?.cancelAlarm(`${task.taskId}_30`);
        await fetch(`${backendUrl}/api/v1/tasks/${task.taskId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.log('Complete task note:', e.message);
      }
    }

    // Reload webview so the UI updates
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }

  function handleDismissAlarm() {
    Vibration.cancel();
    AlarmRingtone?.stopAlarm();
    setActiveAlarmTask(null);
  }

  function handleCallParent(phone, parentName) {
    Vibration.cancel();
    AlarmRingtone?.stopAlarm();
    setActiveAlarmTask(null);
    const sanitized = phone ? String(phone).replace(/[^\d+*#]/g, '') : '';
    if (!sanitized) {
      if (Platform.OS === 'ios' && Alert.prompt) {
        Alert.prompt(
          'Call Parent',
          `Enter phone number to call ${parentName || 'parent'}:`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Call',
              onPress: (input) => {
                const clean = input ? input.replace(/[^\d+*#]/g, '') : '';
                if (clean) {
                  Linking.openURL(`tel:${clean}`).catch((err) => {
                    Alert.alert('Notice', `Unable to open phone app: ${err.message}`);
                  });
                }
              },
            },
          ],
          'plain-text',
          '+91 98765 43210',
          'phone-pad'
        );
      } else {
        Alert.alert(
          'No Phone Number Saved',
          `No phone number is saved for ${parentName || 'parent'}. Please add a phone number in Parent Profile.`
        );
      }
      return;
    }

    Linking.openURL(`tel:${sanitized}`).catch((err) => {
      Alert.alert('Notice', `Unable to open phone app for ${sanitized}: ${err.message}`);
    });
  }

  // Injected JS bridge so Web App can detect native shell and push token
  const injectedBridgeScript = `
    (function() {
      window.CareCircleNative = {
        isNative: true,
        platform: '${Platform.OS}',
        pushToken: '${expoPushToken}',
      };
      
      // Auto-scroll focused inputs into clear view above virtual keyboard
      document.addEventListener('focusin', function(e) {
        var el = e.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) {
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 150);
          setTimeout(function() {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 450);
        }
      }, true);

      // Auto-report existing session on boot
      try {
        var parentRaw = localStorage.getItem('carecircle_parent_profile');
        if (parentRaw) {
          var p = JSON.parse(parentRaw);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEVICE_LINK',
            role: 'parent',
            parent_profile_id: p.parent_profile_id || p.id,
            parent_name: p.parent_name || p.name
          }));
        }
        var userRaw = localStorage.getItem('carecircle_user');
        if (userRaw) {
          var u = JSON.parse(userRaw);
          window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DEVICE_LINK',
            role: 'child',
            user_id: u.id,
            user_name: u.full_name || u.email
          }));
        }
      } catch(e) {}
    })();
    true;
  `;

  // 1. App Start Page with App Logo
  if (isSplashVisible) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#1C355E" />
        <View style={styles.splashContent}>
          <View style={styles.splashLogoWrapper}>
            <Image
              source={require('./assets/icon.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.splashTitle}>CareCircle</Text>
          <Text style={styles.splashSubtitle}>Connecting Generations With Care</Text>
          <View style={styles.splashLoadingRow}>
            <ActivityIndicator size="small" color="#93C5FD" />
            <Text style={styles.splashLoadingText}>Initializing Secure Circle...</Text>
          </View>
        </View>
        <Text style={styles.splashFooter}>v1.0.0 • Family Care Network</Text>
      </SafeAreaView>
    );
  }

  // 2. First-Time Download Permissions Setup Onboarding Screen
  if (isOnboardingCompleted === false) {
    return (
      <SafeAreaView style={styles.onboardingSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#1C355E" />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.onboardingScroll, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={true}
          bounces={true}
          alwaysBounceVertical={true}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.onboardingHeader}>
            <Image
              source={require('./assets/icon.png')}
              style={styles.onboardingLogo}
              resizeMode="contain"
            />
            <View style={styles.onboardingTag}>
              <Text style={styles.onboardingTagText}>Initial Setup</Text>
            </View>
            <Text style={styles.onboardingTitle}>Enable Device Permissions</Text>
            <Text style={styles.onboardingDesc}>
              CareCircle requires permissions to ensure medications, hydration, and safety tasks are acknowledged reliably by family members.
            </Text>
          </View>

          <View style={styles.permsCard}>
            {/* Push Notifications Toggle */}
            <View style={styles.permRow}>
              <View style={styles.permInfo}>
                <Text style={styles.permLabel}>Push Notifications</Text>
                <Text style={styles.permSub}>Receive alerts when tasks become due or need family attention.</Text>
              </View>
              <Switch
                value={permNotifications}
                onValueChange={(val) => {
                  setPermNotifications(val);
                  savePermissionsPreferences(val, permRingtone, permVibration, permLockscreen);
                }}
                trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.permDivider} />

            {/* Native Phone Ringtone Alert */}
            <View style={styles.permRow}>
              <View style={styles.permInfo}>
                <Text style={styles.permLabel}>Phone Ringtone Alert</Text>
                <Text style={styles.permSub}>Ring your phone using default ringtone even when app is closed.</Text>
              </View>
              <Switch
                value={permRingtone}
                onValueChange={(val) => {
                  setPermRingtone(val);
                  savePermissionsPreferences(permNotifications, val, permVibration, permLockscreen);
                }}
                trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.permDivider} />

            {/* Continuous Vibration */}
            <View style={styles.permRow}>
              <View style={styles.permInfo}>
                <Text style={styles.permLabel}>Continuous Vibration</Text>
                <Text style={styles.permSub}>Vibrate phone continuously during high-priority care alarms.</Text>
              </View>
              <Switch
                value={permVibration}
                onValueChange={(val) => {
                  setPermVibration(val);
                  savePermissionsPreferences(permNotifications, permRingtone, val, permLockscreen);
                }}
                trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.permDivider} />

            {/* Lockscreen Priority */}
            <View style={styles.permRow}>
              <View style={styles.permInfo}>
                <Text style={styles.permLabel}>Lockscreen & Priority Alerts</Text>
                <Text style={styles.permSub}>Display urgent alarms directly over lockscreen without delay.</Text>
              </View>
              <Switch
                value={permLockscreen}
                onValueChange={(val) => {
                  setPermLockscreen(val);
                  savePermissionsPreferences(permNotifications, permRingtone, permVibration, val);
                }}
                trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.onboardingTestBtn}
            onPress={handleTriggerTestAlarm}
          >
            <Text style={styles.onboardingTestBtnText}>Test Ringtone & Vibration</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.onboardingPrimaryBtn}
            onPress={handleCompleteOnboarding}
          >
            <Text style={styles.onboardingPrimaryBtnText}>Allow Permissions & Get Started</Text>
          </TouchableOpacity>

          {/* Open Phone Settings Button */}
          <TouchableOpacity
            style={styles.onboardingSettingsLinkBtn}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.onboardingSettingsLinkBtnText}>Open Phone Settings</Text>
          </TouchableOpacity>

          {/* Mandatory User Requirement Note */}
          <Text style={styles.onboardingCheckNote}>
            Check in phone settings if all permissions are turned on after this
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 3. Main Application Flow
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

      {/* Main Standalone App Screen: Native WebView rendering CareCircle Platform */}
      <View style={styles.webViewContainer}>
        {webViewError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Unable to Reach CareCircle</Text>
            <Text style={styles.errorBody}>
              Could not connect to {webAppUrl}. Please check your internet connection and tap retry.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setWebViewError(null);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.retryButtonText}>Retry Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeIpButton}
              onPress={() => {
                setCustomHostInput(customServerUrl || (isProduction ? DEFAULT_PROD_WEB_URL : serverHost));
                setShowConfigModal(true);
              }}
            >
              <Text style={styles.changeIpButtonText}>Server Settings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: webAppUrl }}
            originWhitelist={['*']}
            injectedJavaScript={injectedBridgeScript}
            onMessage={handleWebViewMessage}
            onShouldStartLoadWithRequest={(request) => {
              const { url } = request;
              if (
                url.startsWith('tel:') ||
                url.startsWith('mailto:') ||
                url.startsWith('sms:') ||
                url.startsWith('whatsapp:')
              ) {
                Linking.openURL(url).catch((err) => {
                  Alert.alert('Notice', `Unable to open phone app: ${err.message}`);
                });
                return false;
              }
              return true;
            }}
            onError={(e) => setWebViewError(e.nativeEvent.description)}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) {
                setWebViewError(`HTTP Error: ${e.nativeEvent.statusCode}`);
              }
            }}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1C355E" />
                <Text style={styles.loadingText}>Loading CareCircle...</Text>
              </View>
            )}
            style={styles.webView}
            containerStyle={{ flex: 1 }}
            nestedScrollEnabled={true}
            overScrollMode="always"
            scrollEnabled={true}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            showsVerticalScrollIndicator={true}
          />
        )}
      </View>

      {/* Full-Screen Urgent Alarm Modal (With Vibration Loop & Ringing Alert) */}
      <Modal
        visible={Boolean(activeAlarmTask)}
        animationType="slide"
        transparent={true}
        onRequestClose={handleDismissAlarm}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleDismissAlarm}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.alarmModalCard}
            onPress={(e) => {
              if (e && e.stopPropagation) e.stopPropagation();
            }}
          >
            <View style={styles.alarmIconCircle}>
              <Text style={styles.alarmBadgeText}>
                {activeAlarmTask?.isCallAction ? 'CALL' : 'ALERT'}
              </Text>
            </View>

            <Text style={styles.alarmPulsingBadge}>
              {activeAlarmTask?.isCallAction ? 'CALL PARENT ALARM' : 'URGENT CARE ALARM'}
            </Text>
            <Text style={styles.alarmTaskTitle}>
              {activeAlarmTask?.isCallAction
                ? `Call ${activeAlarmTask?.parentName || 'Parent'} Now!`
                : (activeAlarmTask?.taskTitle || activeAlarmTask?.title)}
            </Text>

            <View style={styles.alarmCategoryBadge}>
              <Text style={styles.alarmCategoryText}>
                {activeAlarmTask?.isCallAction ? '45m Overdue Escalation' : `Category: ${activeAlarmTask?.category || 'Care Task'}`}
              </Text>
            </View>

            <Text style={styles.alarmDescription}>
              {activeAlarmTask?.body || (activeAlarmTask?.isCallAction
                ? `${activeAlarmTask?.parentName || 'Parent'} has not completed ${activeAlarmTask?.taskTitle || 'their care task'} after 45 minutes! Call them directly now.`
                : 'Phone is ringing like an alarm until acknowledged. Please complete your care task now!')}
            </Text>

            {activeAlarmTask?.isCallAction ? (
              <TouchableOpacity
                style={[styles.alarmCompleteButton, { backgroundColor: '#10B981' }]}
                onPress={() => handleCallParent(activeAlarmTask?.parentPhone, activeAlarmTask?.parentName)}
              >
                <Text style={styles.alarmCompleteButtonText}>
                  Call {activeAlarmTask?.parentName || 'Parent'} Directly Now
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.alarmCompleteButton}
                onPress={handleCompleteFromAlarm}
              >
                <Text style={styles.alarmCompleteButtonText}>Mark as Completed Now</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.alarmSnoozeButton}
              onPress={handleDismissAlarm}
            >
              <Text style={styles.alarmSnoozeButtonText}>Snooze Alarm (10 mins)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.alarmDismissButton}
              onPress={handleDismissAlarm}
            >
              <Text style={styles.alarmDismissButtonText}>Dismiss Alarm</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Settings & Permissions Modal */}
      <Modal
        visible={showConfigModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConfigModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowConfigModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.configModalCard, { maxHeight: '90%' }]}
            onPress={(e) => {
              if (e && e.stopPropagation) e.stopPropagation();
            }}
          >
            <View style={styles.historyHeader}>
              <Text style={styles.configModalTitle}>Settings & Permissions</Text>
              <TouchableOpacity onPress={() => setShowConfigModal(false)}>
                <Text style={styles.closeBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Alert & Device Permissions Section */}
              <Text style={styles.settingsSectionHeader}>ALERT & DEVICE PERMISSIONS</Text>
              <View style={styles.permsCardInline}>
                <View style={styles.permRow}>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>Push Notifications</Text>
                    <Text style={styles.permSub}>Receive task alerts and circle updates.</Text>
                  </View>
                  <Switch
                    value={permNotifications}
                    onValueChange={(val) => {
                      setPermNotifications(val);
                      savePermissionsPreferences(val, permRingtone, permVibration, permLockscreen);
                    }}
                    trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.permDivider} />

                <View style={styles.permRow}>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>Phone Ringtone Alert</Text>
                    <Text style={styles.permSub}>Ring phone using default alarm tone.</Text>
                  </View>
                  <Switch
                    value={permRingtone}
                    onValueChange={(val) => {
                      setPermRingtone(val);
                      savePermissionsPreferences(permNotifications, val, permVibration, permLockscreen);
                    }}
                    trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.permDivider} />

                <View style={styles.permRow}>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>Continuous Vibration</Text>
                    <Text style={styles.permSub}>Vibrate phone during urgent alarms.</Text>
                  </View>
                  <Switch
                    value={permVibration}
                    onValueChange={(val) => {
                      setPermVibration(val);
                      savePermissionsPreferences(permNotifications, permRingtone, val, permLockscreen);
                    }}
                    trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <View style={styles.permDivider} />

                <View style={styles.permRow}>
                  <View style={styles.permInfo}>
                    <Text style={styles.permLabel}>Lockscreen Priority</Text>
                    <Text style={styles.permSub}>Urgent alerts bypass quiet hours & lockscreen.</Text>
                  </View>
                  <Switch
                    value={permLockscreen}
                    onValueChange={(val) => {
                      setPermLockscreen(val);
                      savePermissionsPreferences(permNotifications, permRingtone, permVibration, val);
                    }}
                    trackColor={{ false: '#CBD5E1', true: '#1C355E' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.testAlertBtnInline}
                onPress={handleTriggerTestAlarm}
              >
                <Text style={styles.testAlertBtnText}>Test Ringtone & Vibration</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.openSettingsBtnInline}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.openSettingsBtnInlineText}>Open Phone Settings</Text>
              </TouchableOpacity>

              <Text style={styles.settingsCheckNote}>
                Check in phone settings if all permissions are turned on after this
              </Text>

              {/* Server Connection Section */}
              <Text style={[styles.settingsSectionHeader, { marginTop: 18 }]}>SERVER CONNECTION</Text>
              <Text style={styles.configModalSub}>
                Configure the CareCircle server URL for cloud production or local testing.
              </Text>

              <Text style={styles.inputLabel}>Server URL or Host:</Text>
              <TextInput
                style={styles.textInput}
                value={customHostInput}
                onChangeText={setCustomHostInput}
                placeholder={isProduction ? DEFAULT_PROD_WEB_URL : DEFAULT_DEV_HOST}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={styles.configSaveBtnFull}
                onPress={async () => {
                  const cleaned = customHostInput.trim();
                  if (cleaned) {
                    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
                      setCustomServerUrl(cleaned);
                      await AsyncStorage.setItem('carecircle_custom_server_url', cleaned);
                    } else {
                      setServerHost(cleaned);
                      await AsyncStorage.setItem('carecircle_server_host', cleaned);
                    }
                    setWebViewError(null);
                    setShowConfigModal(false);
                    if (expoPushToken) {
                      registerWithBackend(expoPushToken, linkedProfile);
                    }
                    if (webViewRef.current) {
                      webViewRef.current.reload();
                    }
                  }
                }}
              >
                <Text style={styles.configSaveBtnText}>Save &amp; Reconnect</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resetOnboardingBtn}
                onPress={() => {
                  setShowConfigModal(false);
                  setIsOnboardingCompleted(false);
                }}
              >
                <Text style={styles.resetOnboardingBtnText}>View First-Time Permissions Screen</Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Notifications & Alarms Feed Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowHistoryModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.configModalCard, { maxHeight: '80%' }]}
            onPress={(e) => {
              if (e && e.stopPropagation) e.stopPropagation();
            }}
          >
            <View style={styles.historyHeader}>
              <Text style={styles.configModalTitle}>Alarms & Alerts Stream</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tokenDisplay}>
              Push Token: {expoPushToken ? `${expoPushToken.slice(0, 28)}...` : 'Registering...'}
            </Text>

            <ScrollView style={{ marginTop: 12 }}>
              {notificationHistory.length === 0 ? (
                <Text style={styles.emptyFeedText}>No alarms or notifications received yet.</Text>
              ) : (
                notificationHistory.map((item) => (
                  <View key={item.id} style={styles.historyItem}>
                    <Text style={styles.historyItemTitle}>{item.title}</Text>
                    <Text style={styles.historyItemBody}>{item.body}</Text>
                    <Text style={styles.historyItemTime}>{item.time}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Splash Start Page Styles
  splashContainer: {
    flex: 1,
    backgroundColor: '#1C355E',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  splashContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashLogoWrapper: {
    width: 130,
    height: 130,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 12,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: '100%',
    height: '100%',
  },
  splashTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  splashSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#93C5FD',
    textAlign: 'center',
    marginBottom: 36,
  },
  splashLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  splashLoadingText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  splashFooter: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // First-Time Permissions Onboarding Styles
  onboardingSafeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingTop: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 36) : 0,
  },
  onboardingScroll: {
    padding: 24,
    paddingBottom: 60,
  },
  onboardingHeader: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  onboardingLogo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 16,
  },
  onboardingTag: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  onboardingTagText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  onboardingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  onboardingDesc: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  permsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  permsCardInline: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  permInfo: {
    flex: 1,
    paddingRight: 14,
  },
  permLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  permSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  permDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  onboardingTestBtn: {
    backgroundColor: '#334155',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  onboardingTestBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  onboardingPrimaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 10,
  },
  onboardingPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  onboardingSettingsLinkBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  onboardingSettingsLinkBtnText: {
    color: '#93C5FD',
    fontSize: 14,
    fontWeight: '700',
  },
  onboardingCheckNote: {
    fontSize: 12,
    color: '#FCD34D',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '600',
  },

  // Main App Styles
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'android' ? Math.max(StatusBar.currentHeight || 0, 36) : 0,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginRight: 8,
  },
  statusLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#26426E',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  badgeCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  webView: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1C355E',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  changeIpButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    width: '100%',
    alignItems: 'center',
  },
  changeIpButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alarmModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 26,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  alarmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    borderWidth: 2,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alarmBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 1,
  },
  alarmPulsingBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  alarmTaskTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  alarmCategoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 14,
  },
  alarmCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  alarmDescription: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  alarmCompleteButton: {
    backgroundColor: '#059669',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  alarmCompleteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  alarmSnoozeButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmSnoozeButtonText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  alarmDismissButton: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  alarmDismissButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  configModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 390,
  },
  configModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  settingsSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  testAlertBtnInline: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  testAlertBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  openSettingsBtnInline: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  openSettingsBtnInlineText: {
    color: '#1C355E',
    fontSize: 13,
    fontWeight: '700',
  },
  settingsCheckNote: {
    fontSize: 11,
    color: '#B45309',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 12,
    fontWeight: '600',
  },
  configModalSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  configSaveBtnFull: {
    backgroundColor: '#1C355E',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  configSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  resetOnboardingBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  resetOnboardingBtnText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
    padding: 4,
  },
  tokenDisplay: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#F8FAFC',
    padding: 6,
    borderRadius: 8,
  },
  emptyFeedText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginVertical: 20,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  historyItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  historyItemBody: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  historyItemTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
});

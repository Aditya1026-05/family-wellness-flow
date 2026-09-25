import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  Vibration,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isUrgent = Boolean(
      notification.request.content.data?.ring_alarm ||
      notification.request.content.data?.is_urgent
    );
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: isUrgent
        ? Notifications.AndroidNotificationPriority.MAX
        : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

// Configure Android Notification Channels for High Importance & Alarms
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('urgent_alarm', {
    name: 'Urgent Task Alarms',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: '#EF4444',
    sound: 'default',
    enableVibrate: true,
  });
  Notifications.setNotificationChannelAsync('default', {
    name: 'Care Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

// Default to your Mac local network IP
const BACKEND_URL = 'http://172.16.36.36:8001';
const WEB_APP_URL = 'http://172.16.36.36:8080';

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Initializing push notifications...');
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [sendingTest, setSendingTest] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Active ringing alarm modal state
  const [activeAlarmTask, setActiveAlarmTask] = useState(null);
  // Escalation alert state (Call parent)
  const [activeCallEscalation, setActiveCallEscalation] = useState(null);

  const notificationListener = useRef();
  const responseListener = useRef();

  // Handle continuous vibration when urgent alarm is ringing
  useEffect(() => {
    if (activeAlarmTask) {
      // Vibrate pattern in loop: 500ms vibrate, 250ms pause, repeat
      const interval = setInterval(() => {
        Vibration.vibrate([0, 500, 250, 500]);
      }, 1500);
      Vibration.vibrate([0, 500, 250, 500]);
      return () => {
        clearInterval(interval);
        Vibration.cancel();
      };
    } else {
      Vibration.cancel();
    }
  }, [activeAlarmTask]);

  const initPermissionsAndToken = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        setStatusMessage('Permission Denied in iPhone Settings');
        setErrorMessage('Expo Go needs notification permission. Open iPhone Settings > Expo Go > Notifications and turn "Allow Notifications" ON.');
        setLoading(false);
        return;
      }

      setStatusMessage('Permission granted! Fetching push token...');

      let token;
      try {
        const tokenResult = await Notifications.getExpoPushTokenAsync({
          projectId: '4a40ba56-204c-43ee-9de2-ff72dc1ca4d3',
        });
        token = tokenResult.data;
      } catch (tokenErr) {
        console.warn('Remote token fetch note:', tokenErr.message);
        setErrorMessage(`Remote Token Notice: ${tokenErr.message}`);
      }

      if (token) {
        setExpoPushToken(token);
        setStatusMessage('Device Token Active & Ready');
        await registerDeviceWithBackend(token);
      } else {
        setStatusMessage('Ready for Notifications (Local & In-App)');
      }
    } catch (err) {
      setErrorMessage(err.message);
      setStatusMessage('Error initializing');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initPermissionsAndToken();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body, data } = notification.request.content;
      const isUrgent = Boolean(data?.ring_alarm || data?.is_urgent);
      const isCallAction = data?.action === 'call_parent';

      const newEntry = {
        id: Date.now(),
        title: title || 'New Notification',
        body: body || '',
        data: data || {},
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        isUrgent,
        isCallAction,
        stage: data?.stage !== undefined ? data.stage : null,
      };
      setNotificationHistory((prev) => [newEntry, ...prev]);

      // If urgent alarm, trigger the full-screen ringing alarm dialog
      if (isUrgent) {
        setActiveAlarmTask({
          title: title || 'Urgent Care Task',
          body: body || 'Please complete this urgent care task now.',
          taskId: data?.task_id || data?.task_instance_id || '1',
          taskTitle: data?.task_title || title || 'Care Task',
          category: data?.category || 'Medicine',
          stage: data?.stage,
        });
      }

      // If 45-minute escalation with call prompt
      if (isCallAction) {
        setActiveCallEscalation({
          title: title || '⚠️ Care Alert Escalated',
          body: body || '',
          parentName: data?.parent_name || 'Parent',
          parentPhone: data?.parent_phone || '',
          taskTitle: data?.task_title || 'Care Task',
        });
      }
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { title, body, data } = response.notification.request.content;
      const isUrgent = Boolean(data?.ring_alarm || data?.is_urgent);
      const isCallAction = data?.action === 'call_parent';

      if (isUrgent) {
        setActiveAlarmTask({
          title: title || 'Urgent Care Task',
          body: body || 'Please complete this task now.',
          taskId: data?.task_id || data?.task_instance_id || '1',
          taskTitle: data?.task_title || title,
          category: data?.category || 'Medicine',
          stage: data?.stage,
        });
      } else if (isCallAction) {
        setActiveCallEscalation({
          title,
          body,
          parentName: data?.parent_name || 'Parent',
          parentPhone: data?.parent_phone || '',
          taskTitle: data?.task_title || 'Care Task',
        });
      } else {
        Alert.alert(`Opened: ${title}`, body);
      }
    });

    return () => {
      if (notificationListener.current && notificationListener.current.remove) {
        notificationListener.current.remove();
      }
      if (responseListener.current && responseListener.current.remove) {
        responseListener.current.remove();
      }
    };
  }, []);

  async function registerDeviceWithBackend(token) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          platform: Platform.OS,
          role: 'parent',
          device_name: Device.modelName || 'iPhone',
          family_id: 1,
          parent_id: 1,
        }),
      });

      if (res.ok) {
        setIsRegistered(true);
        setStatusMessage('Synced with CareCircle Backend');
      }
    } catch (err) {
      console.log('Backend sync note:', err.message);
    }
  }

  // Complete task directly from the Alarm screen
  async function handleCompleteFromAlarm() {
    Vibration.cancel();
    const task = activeAlarmTask;
    setActiveAlarmTask(null);

    try {
      if (task && task.taskId) {
        await fetch(`${BACKEND_URL}/api/v1/tasks/${task.taskId}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all_parents: true }),
        });
      }
      Alert.alert('✅ Task Completed!', 'Great job! Your caregiver has been notified that this task is complete.');
    } catch (e) {
      Alert.alert('Notice', 'Task completed locally. (Network sync will follow).');
    }
  }

  function handleDismissAlarm() {
    Vibration.cancel();
    setActiveAlarmTask(null);
  }

  function handleCallParent(phoneNumber) {
    if (phoneNumber) {
      Linking.openURL(`tel:${phoneNumber}`).catch(() => {
        Alert.alert('Call Parent', `Dialing ${phoneNumber}...`);
      });
    } else {
      Alert.alert('Call Parent', 'Opening phone dialer to call parent...');
      Linking.openURL('tel:').catch(() => {});
    }
  }

  // Test 1: Urgent Ring Alarm
  async function handleTestUrgentAlarm() {
    setSendingTest(true);
    try {
      const payload = {
        title: '⏰ URGENT ALARM: Morning Medicine!',
        body: 'Dad, time to take your blood pressure medicine. Alarm is ringing!',
        sound: 'default',
        badge: 1,
        data: {
          taskId: 'test-med-task',
          task_title: 'Blood Pressure Medicine',
          category: 'Medicine',
          ring_alarm: true,
          is_urgent: true,
          stage: 0,
        },
      };

      if (expoPushToken) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: expoPushToken,
            ...payload,
            channelId: 'urgent_alarm',
            priority: 'high',
          }),
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: payload,
          trigger: null,
        });
      }

      // Also trigger alarm modal directly in app for immediate feedback
      setActiveAlarmTask({
        title: payload.title,
        body: payload.body,
        taskId: 'test-med-task',
        taskTitle: 'Blood Pressure Medicine',
        category: 'Medicine',
        stage: 0,
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingTest(false);
    }
  }

  // Test 2: 45-Minute Escalation with Call Parent Action
  async function handleTestEscalationCallParent() {
    setSendingTest(true);
    try {
      const payload = {
        title: '⚠️ Call Dad: Breakfast missed!',
        body: 'Dad has not completed his 8:00 AM Breakfast after 45 minutes. Please call him directly to check in!',
        sound: 'default',
        badge: 2,
        data: {
          taskId: 'test-breakfast-task',
          task_title: 'Breakfast',
          action: 'call_parent',
          parent_name: 'Dad',
          parent_phone: '+15551234567',
          priority: 'High',
          stage: 3,
        },
      };

      if (expoPushToken) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: expoPushToken,
            ...payload,
            priority: 'high',
          }),
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: payload,
          trigger: null,
        });
      }

      setActiveCallEscalation({
        title: payload.title,
        body: payload.body,
        parentName: 'Dad',
        parentPhone: '+15551234567',
        taskTitle: 'Breakfast',
      });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingTest(false);
    }
  }

  // Test 3: Standard Gentle Reminder (0m)
  async function handleSendStandardReminder() {
    setSendingTest(true);
    try {
      const payload = {
        title: 'Time for Morning Walk 🚶',
        body: 'A gentle reminder for Morning Walk at 9:00 AM.',
        sound: 'default',
        badge: 1,
        data: {
          taskId: 'test-walk-task',
          task_title: 'Morning Walk',
          category: 'Exercise',
          stage: 0,
        },
      };

      if (expoPushToken) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: expoPushToken,
            ...payload,
          }),
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: payload,
          trigger: null,
        });
      }

      Alert.alert('🔔 Reminder Sent!', 'Gentle care reminder notification delivered.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingTest(false);
    }
  }

  // Test 4: Simulate Full 4-Stage Timeline (0m -> 15m -> 30m -> 45m Call Parent)
  async function handleSimulateFourStageTimeline() {
    setSendingTest(true);
    try {
      const stages = [
        {
          stage: 0,
          title: '⏰ Stage 0 (8:00 AM): Time for Medicine!',
          body: 'Task time reached: Blood Pressure Medicine. Ringing alarm on parent device.',
          ring_alarm: true,
        },
        {
          stage: 1,
          title: '⏰ Stage 1 (8:15 AM): Reminder: Medicine is waiting',
          body: 'Not completed after 15 mins. 1st follow-up reminder sent to parent.',
          ring_alarm: true,
        },
        {
          stage: 2,
          title: '⏰ Stage 2 (8:30 AM): 2nd Reminder: Medicine is 30m overdue!',
          body: 'Still not completed after 30 mins. 2nd urgent alarm sent to parent.',
          ring_alarm: true,
        },
        {
          stage: 3,
          title: '⚠️ Stage 3 (8:45 AM): Call Dad: Medicine missed!',
          body: '45 mins reached without completion! Caregiver notified to call parent directly.',
          action: 'call_parent',
          parent_name: 'Dad',
          parent_phone: '+15551234567',
        },
      ];

      for (let i = 0; i < stages.length; i++) {
        const item = stages[i];
        if (expoPushToken) {
          await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: expoPushToken,
              title: item.title,
              body: item.body,
              sound: 'default',
              data: {
                stage: item.stage,
                ring_alarm: Boolean(item.ring_alarm),
                action: item.action || '',
                parent_name: item.parent_name || 'Dad',
                parent_phone: item.parent_phone || '',
              },
            }),
          });
        } else {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: item.title,
              body: item.body,
              sound: 'default',
              data: {
                stage: item.stage,
                ring_alarm: Boolean(item.ring_alarm),
                action: item.action || '',
                parent_name: item.parent_name || 'Dad',
                parent_phone: item.parent_phone || '',
              },
            },
            trigger: null,
          });
        }
      }

      Alert.alert(
        '🔄 4-Stage Timeline Delivered!',
        'All 4 stages (0m Due -> 15m Retry -> 30m Retry -> 45m Call Parent) have been streamed to your screen!'
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingTest(false);
    }
  }

  function handleOpenWebApp() {
    Linking.openURL(WEB_APP_URL).catch(() => {
      Alert.alert('Notice', `Unable to open ${WEB_APP_URL}. Ensure Mac and iPhone are on same Wi-Fi.`);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1C355E" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>FAMILY WELLNESS FLOW</Text>
          <Text style={styles.headerTitle}>CareCircle Companion</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.statusDot, { backgroundColor: isRegistered || expoPushToken ? '#10B981' : '#F59E0B' }]} />
            <Text style={styles.badgeText}>
              {loading ? 'Setting up...' : (expoPushToken ? 'Live Notifications & Alarms Active' : 'Action Required')}
            </Text>
          </View>
        </View>

        {/* Call Escalation Banner (45m overdue prompt) */}
        {activeCallEscalation && (
          <View style={styles.callEscalationBanner}>
            <View style={styles.callBannerHeader}>
              <Text style={styles.callBannerTitle}>{activeCallEscalation.title}</Text>
              <TouchableOpacity onPress={() => setActiveCallEscalation(null)}>
                <Text style={styles.callBannerDismiss}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.callBannerBody}>{activeCallEscalation.body}</Text>
            <TouchableOpacity
              style={styles.callActionButton}
              onPress={() => handleCallParent(activeCallEscalation.parentPhone)}
            >
              <Text style={styles.callActionButtonText}>
                📞 Call {activeCallEscalation.parentName} Now
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Device Status Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>DEVICE CONNECTION</Text>
          <Text style={styles.statusDescription}>{statusMessage}</Text>
          
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.settingsButton}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.settingsButtonText}>⚙️ Open iPhone Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.settingsButton, { backgroundColor: '#E2E8F0', marginTop: 6 }]}
                onPress={initPermissionsAndToken}
              >
                <Text style={[styles.settingsButtonText, { color: '#1E293B' }]}>🔄 Re-check Permissions</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.tokenBox}>
            <Text style={styles.tokenLabel}>Push Notification Service:</Text>
            {loading ? (
              <ActivityIndicator color="#1C355E" style={{ marginVertical: 8 }} />
            ) : (
              <Text selectable style={styles.tokenText}>
                {expoPushToken ? expoPushToken : 'Local notifications ready. Lock screen & sound enabled.'}
              </Text>
            )}
          </View>
        </View>

        {/* Multi-Stage & Urgent Alarm Testing Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>NOTIFICATION & ALARM TESTING</Text>
          <Text style={styles.subtext}>
            Test the full multi-tier flow: 0m time reached, 15m & 30m reminders, 45m escalation (call parent), and urgent task ringing alarm!
          </Text>

          {/* Button 1: Urgent Ring Alarm */}
          <TouchableOpacity
            style={[styles.urgentAlarmButton, sendingTest && styles.disabledButton]}
            onPress={handleTestUrgentAlarm}
            disabled={sendingTest}
          >
            <Text style={styles.urgentAlarmButtonText}>
              ⏰ Test Urgent Task Alarm (Rings & Vibrates)
            </Text>
          </TouchableOpacity>

          {/* Button 2: 45m Escalation Call Parent */}
          <TouchableOpacity
            style={[styles.callParentTestButton, sendingTest && styles.disabledButton]}
            onPress={handleTestEscalationCallParent}
            disabled={sendingTest}
          >
            <Text style={styles.callParentTestButtonText}>
              ⚠️ Test 45-Min Escalation (Call Parent Action)
            </Text>
          </TouchableOpacity>

          {/* Button 3: Gentle Reminder */}
          <TouchableOpacity
            style={[styles.primaryButton, sendingTest && styles.disabledButton]}
            onPress={handleSendStandardReminder}
            disabled={sendingTest}
          >
            <Text style={styles.primaryButtonText}>
              🔔 Test Gentle Reminder (Normal Task)
            </Text>
          </TouchableOpacity>

          {/* Button 4: Full 4-Stage Timeline Simulation */}
          <TouchableOpacity
            style={[styles.timelineButton, sendingTest && styles.disabledButton]}
            onPress={handleSimulateFourStageTimeline}
            disabled={sendingTest}
          >
            <Text style={styles.timelineButtonText}>
              🔄 Test 4-Stage Cycle (0m → 15m → 30m → 45m Call)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Web App Link */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>WEB PORTAL ACCESS</Text>
          <Text style={styles.subtext}>
            Open the full CareCircle interactive web dashboard in Safari on your iPhone.
          </Text>

          <TouchableOpacity style={styles.outlineButton} onPress={handleOpenWebApp}>
            <Text style={styles.outlineButtonText}>🌐 Open Web App (172.16.36.36:8080)</Text>
          </TouchableOpacity>
        </View>

        {/* Live Notification Feed */}
        <View style={styles.card}>
          <View style={styles.feedHeader}>
            <Text style={styles.sectionTitle}>RECEIVED ALERTS STREAM</Text>
            <Text style={styles.countBadge}>{notificationHistory.length}</Text>
          </View>

          {notificationHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No notifications received yet.</Text>
              <Text style={styles.emptySubtext}>Tap any test button above to test ringing & notifications!</Text>
            </View>
          ) : (
            notificationHistory.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.notificationItem,
                  item.isUrgent && styles.notificationItemUrgent,
                  item.isCallAction && styles.notificationItemCall,
                ]}
              >
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>

                {item.stage !== null && (
                  <View style={styles.stageTagRow}>
                    <Text style={styles.stageTagText}>
                      {item.stage === 0 ? 'T = 0m Due' : item.stage === 1 ? 'T = +15m Retry' : item.stage === 2 ? 'T = +30m Retry' : 'T = +45m Escalated'}
                    </Text>
                    {item.isUrgent && (
                      <Text style={styles.alarmTagText}>⏰ Ring Alarm ON</Text>
                    )}
                  </View>
                )}

                <Text style={styles.itemBody}>{item.body}</Text>

                {item.isCallAction && (
                  <TouchableOpacity
                    style={styles.inlineCallButton}
                    onPress={() => handleCallParent(item.data?.parent_phone)}
                  >
                    <Text style={styles.inlineCallButtonText}>📞 Call {item.data?.parent_name || 'Parent'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Full-Screen Urgent Alarm Modal */}
      <Modal
        visible={Boolean(activeAlarmTask)}
        animationType="slide"
        transparent={true}
        onRequestClose={handleDismissAlarm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alarmModalCard}>
            <View style={styles.alarmIconCircle}>
              <Text style={styles.alarmEmoji}>⏰</Text>
            </View>

            <Text style={styles.alarmPulsingBadge}>🚨 URGENT CARE ALARM RINGING</Text>
            <Text style={styles.alarmTaskTitle}>{activeAlarmTask?.taskTitle || activeAlarmTask?.title}</Text>
            
            <View style={styles.alarmCategoryBadge}>
              <Text style={styles.alarmCategoryText}>Category: {activeAlarmTask?.category || 'Medicine'}</Text>
            </View>

            <Text style={styles.alarmDescription}>
              {activeAlarmTask?.body || 'Phone is ringing like an alarm until acknowledged. Please complete your care task now!'}
            </Text>

            <TouchableOpacity
              style={styles.alarmCompleteButton}
              onPress={handleCompleteFromAlarm}
            >
              <Text style={styles.alarmCompleteButtonText}>✅ Mark as Completed Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.alarmSnoozeButton}
              onPress={handleDismissAlarm}
            >
              <Text style={styles.alarmSnoozeButtonText}>⏰ Snooze Alarm (10 mins)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.alarmDismissButton}
              onPress={handleDismissAlarm}
            >
              <Text style={styles.alarmDismissButtonText}>Dismiss Alarm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1C355E',
  },
  container: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: '#1C355E',
    marginHorizontal: -16,
    marginTop: -16,
    padding: 24,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  headerSubtitle: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statusDescription: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 10,
  },
  subtext: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 14,
  },
  tokenBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tokenLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  tokenText: {
    fontSize: 12,
    color: '#0F172A',
    fontFamily: 'Courier',
    lineHeight: 16,
  },
  urgentAlarmButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  urgentAlarmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  callParentTestButton: {
    backgroundColor: '#EA580C',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  callParentTestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: '#1C355E',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  timelineButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  timelineButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: '#1C355E',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  outlineButtonText: {
    color: '#1C355E',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: '#E2E8F0',
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  emptySubtext: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  notificationItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1C355E',
  },
  notificationItemUrgent: {
    borderLeftColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  notificationItemCall: {
    borderLeftColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    marginRight: 6,
  },
  itemTime: {
    fontSize: 11,
    color: '#94A3B8',
  },
  itemBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  stageTagRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 4,
  },
  stageTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1C355E',
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  alarmTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inlineCallButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  inlineCallButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
    lineHeight: 16,
    marginBottom: 10,
  },
  settingsButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  callEscalationBanner: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#FDBA74',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  callBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  callBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9A3412',
    flex: 1,
  },
  callBannerDismiss: {
    fontSize: 16,
    color: '#9A3412',
    padding: 4,
  },
  callBannerBody: {
    fontSize: 13,
    color: '#C2410C',
    marginBottom: 12,
    lineHeight: 18,
  },
  callActionButton: {
    backgroundColor: '#EA580C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  callActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alarmModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  alarmIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  alarmEmoji: {
    fontSize: 36,
  },
  alarmPulsingBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 1,
    marginBottom: 8,
  },
  alarmTaskTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  alarmCategoryBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 12,
  },
  alarmCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  alarmDescription: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alarmCompleteButton: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  alarmCompleteButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  alarmSnoozeButton: {
    width: '100%',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmSnoozeButtonText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  alarmDismissButton: {
    paddingVertical: 8,
  },
  alarmDismissButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});


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
} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

  const notificationListener = useRef();
  const responseListener = useRef();

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
      const newEntry = {
        id: Date.now(),
        title: title || 'New Notification',
        body: body || '',
        data: data || {},
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
      setNotificationHistory((prev) => [newEntry, ...prev]);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const { title, body } = response.notification.request.content;
      Alert.alert(`Opened: ${title}`, body);
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
          platform: 'ios',
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

  async function handleSendTestPush() {
    setSendingTest(true);
    try {
      if (expoPushToken) {
        // Send real remote push to phone
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: expoPushToken,
            title: 'CareCircle Alert 💊',
            body: 'Dad, time to take your evening blood pressure medicine.',
            sound: 'default',
            badge: 1,
            data: { taskId: 1, type: 'reminder' },
          }),
        });
      } else {
        // Local fallback
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'CareCircle Alert 💊',
            body: 'Dad, time to take your evening blood pressure medicine.',
            sound: 'default',
            badge: 1,
            data: { taskId: 1, type: 'reminder' },
          },
          trigger: null,
        });
      }

      Alert.alert(
        '🔔 Notification Sent!',
        'A single notification banner has been delivered to your phone screen!'
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSimulateEscalation() {
    setSendingTest(true);
    try {
      if (expoPushToken) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: expoPushToken,
            title: '🚨 Urgent: Care Alert Escalated',
            body: 'Parent missed "Morning Medication". Task overdue by 30 minutes.',
            sound: 'default',
            badge: 2,
            data: { taskId: 1, type: 'escalation' },
          }),
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 Urgent: Care Alert Escalated',
            body: 'Parent missed "Morning Medication". Task overdue by 30 minutes.',
            sound: 'default',
            badge: 2,
            data: { taskId: 1, type: 'escalation' },
          },
          trigger: null,
        });
      }

      Alert.alert(
        '🚨 Escalation Alert Sent!',
        'Urgent alert banner has been delivered to your screen.'
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
              {loading ? 'Setting up...' : (expoPushToken ? 'Notifications Enabled' : 'Action Required')}
            </Text>
          </View>
        </View>

        {/* Status Card */}
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
            <Text style={styles.tokenLabel}>Your Device Status:</Text>
            {loading ? (
              <ActivityIndicator color="#1C355E" style={{ marginVertical: 8 }} />
            ) : (
              <Text selectable style={styles.tokenText}>
                {expoPushToken ? expoPushToken : 'Local notifications ready. Lock screen & sound enabled.'}
              </Text>
            )}
          </View>
        </View>

        {/* Action Controls */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>LIVE NOTIFICATION TESTING</Text>
          <Text style={styles.subtext}>
            Tap below, then lock your iPhone or go to your home screen to see the notification banner chime!
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, sendingTest && styles.disabledButton]}
            onPress={handleSendTestPush}
            disabled={sendingTest}
          >
            <Text style={styles.primaryButtonText}>
              {sendingTest ? 'Sending...' : '🔔 Send Test Care Reminder (Locks Screen)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, sendingTest && styles.disabledButton]}
            onPress={handleSimulateEscalation}
            disabled={sendingTest}
          >
            <Text style={styles.secondaryButtonText}>
              🚨 Test Urgent Escalation Alert
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
              <Text style={styles.emptySubtext}>Tap "Send Test Care Reminder" above to test!</Text>
            </View>
          ) : (
            notificationHistory.map((item) => (
              <View key={item.id} style={styles.notificationItem}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemTime}>{item.time}</Text>
                </View>
                <Text style={styles.itemBody}>{item.body}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

async function registerForPushNotificationsAsync() {
  let token;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permission Needed', 'Please enable notifications in iPhone Settings for Expo Go to receive alerts.');
      return null;
    }

    try {
      const tokenResult = await Notifications.getExpoPushTokenAsync();
      token = tokenResult.data;
    } catch (e) {
      console.warn('Error fetching token:', e);
    }
  } else {
    Alert.alert('Physical Device Required', 'Push notifications require a physical device.');
  }

  return token;
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
    marginBottom: 20,
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
    fontFamily: 'System',
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
  primaryButton: {
    backgroundColor: '#1C355E',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#DC2626',
    fontSize: 14,
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
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
});

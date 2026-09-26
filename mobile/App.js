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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// Configure how notifications appear when app is foregrounded
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

// Configure Android Notification Channels for High Importance & Urgent Alarms
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('urgent_alarm', {
    name: 'Urgent Task Alarms',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    lightColor: '#EF4444',
    sound: 'default',
    enableVibrate: true,
  });
  Notifications.setNotificationChannelAsync('carecircle-reminders', {
    name: 'Care Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

// Current Mac local network IP
const DEFAULT_HOST = '172.16.36.36';

export default function App() {
  const [serverHost, setServerHost] = useState(DEFAULT_HOST);
  const [serverPort, setServerPort] = useState('8080');
  const [backendPort, setBackendPort] = useState('8001');

  const [expoPushToken, setExpoPushToken] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);
  const [linkedProfile, setLinkedProfile] = useState(null); // { role, name, id }
  const [activeAlarmTask, setActiveAlarmTask] = useState(null);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [webViewError, setWebViewError] = useState(null);
  const [customHostInput, setCustomHostInput] = useState(DEFAULT_HOST);

  const webViewRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();

  const webAppUrl = `http://${serverHost}:${serverPort}`;
  const backendUrl = `http://${serverHost}:${backendPort}`;

  // Continuous vibration loop while alarm is ringing
  useEffect(() => {
    if (activeAlarmTask) {
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
      const isUrgent = Boolean(data?.ring_alarm || data?.is_urgent);
      const isCallAction = data?.action === 'call_parent';

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

      // Pop native full-screen alarm modal with vibration loop
      if (isUrgent || isCallAction) {
        setActiveAlarmTask({
          title: title || (isCallAction ? `🚨 Call ${data?.parent_name || 'Parent'} Alarm` : 'Urgent Care Alarm'),
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
      const isUrgent = Boolean(data?.ring_alarm || data?.is_urgent);
      const isCallAction = data?.action === 'call_parent';

      if (isUrgent || isCallAction) {
        setActiveAlarmTask({
          title: title || (isCallAction ? `🚨 Call ${data?.parent_name || 'Parent'} Alarm` : 'Urgent Care Alarm'),
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

    return () => {
      if (notificationListener.current?.remove) notificationListener.current.remove();
      if (responseListener.current?.remove) responseListener.current.remove();
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

  // Bridge: handle messages posted by the web app inside the WebView
  function handleWebViewMessage(event) {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'DEVICE_LINK') {
        // Automatically link this physical device to the authenticated parent or child
        setLinkedProfile(data);
        AsyncStorage.setItem('carecircle_linked_profile', JSON.stringify(data)).catch(() => {});
        if (expoPushToken) {
          registerWithBackend(expoPushToken, data);
        }
      } else if (data.type === 'DEVICE_UNLINK') {
        // User logged out or disconnected circle: completely unbind and deactivate token
        setLinkedProfile(null);
        setIsRegistered(false);
        AsyncStorage.removeItem('carecircle_linked_profile').catch(() => {});
        if (expoPushToken) {
          fetch(`${backendUrl}/api/v1/devices/unregister`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: expoPushToken }),
          }).catch(() => {});
        }
      } else if (data.type === 'CALL_PARENT') {
        handleCallParent(data.phone);
      }
    } catch (err) {
      // Ignored if non-json
    }
  }

  // Complete task from the full-screen native alarm modal
  async function handleCompleteFromAlarm() {
    Vibration.cancel();
    const task = activeAlarmTask;
    setActiveAlarmTask(null);

    if (task?.taskId) {
      try {
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
    setActiveAlarmTask(null);
  }

  function handleCallParent(phone) {
    Vibration.cancel();
    setActiveAlarmTask(null);
    const sanitized = phone ? String(phone).replace(/[^\d+*#]/g, '') : '';
    const dialUrl = sanitized ? `tel:${sanitized}` : 'tel:';
    Linking.openURL(dialUrl).catch((err) => {
      Alert.alert('Notice', `Unable to open phone app: ${err.message}`);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1C355E" />

      {/* Top Native Control Pill */}
      <View style={styles.topBar}>
        <View style={styles.statusGroup}>
          <View style={[styles.statusDot, { backgroundColor: isRegistered ? '#10B981' : '#F59E0B' }]} />
          <Text style={styles.statusLabel} numberOfLines={1}>
            {linkedProfile
              ? `👤 ${linkedProfile.parent_name || linkedProfile.user_name || 'Linked'}`
              : (isRegistered ? 'CareCircle Native • Alarms Live' : 'Connecting to Server...')}
          </Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setShowHistoryModal(true)}
          >
            <Text style={styles.iconButtonText}>🔔</Text>
            {notificationHistory.length > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>{notificationHistory.length}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setCustomHostInput(serverHost);
              setShowConfigModal(true);
            }}
          >
            <Text style={styles.iconButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Standalone App Screen: Native WebView rendering CareCircle Platform */}
      <View style={styles.webViewContainer}>
        {webViewError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>🌐</Text>
            <Text style={styles.errorTitle}>Unable to Reach CareCircle Server</Text>
            <Text style={styles.errorBody}>
              Could not connect to {webAppUrl}. Ensure your phone and Mac are connected to the same Wi-Fi network.
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setWebViewError(null);
                webViewRef.current?.reload();
              }}
            >
              <Text style={styles.retryButtonText}>🔄 Retry Connection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeIpButton}
              onPress={() => setShowConfigModal(true)}
            >
              <Text style={styles.changeIpButtonText}>⚙️ Change Server IP ({serverHost})</Text>
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
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
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
        <View style={styles.modalOverlay}>
          <View style={styles.alarmModalCard}>
            <View style={styles.alarmIconCircle}>
              <Text style={styles.alarmEmoji}>{activeAlarmTask?.isCallAction ? '🚨' : '⏰'}</Text>
            </View>

            <Text style={styles.alarmPulsingBadge}>
              {activeAlarmTask?.isCallAction ? '🚨 CALL PARENT ALARM RINGING' : '🚨 URGENT CARE ALARM RINGING'}
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
                onPress={() => handleCallParent(activeAlarmTask?.parentPhone)}
              >
                <Text style={styles.alarmCompleteButtonText}>
                  📞 Call {activeAlarmTask?.parentName || 'Parent'} Directly Now
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.alarmCompleteButton}
                onPress={handleCompleteFromAlarm}
              >
                <Text style={styles.alarmCompleteButtonText}>✅ Mark as Completed Now</Text>
              </TouchableOpacity>
            )}

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

      {/* Server IP Settings Modal */}
      <Modal
        visible={showConfigModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.configModalCard}>
            <Text style={styles.configModalTitle}>⚙️ Server Connection</Text>
            <Text style={styles.configModalSub}>
              Enter your Mac's Wi-Fi IP address so your phone loads the live platform and receives real alarms.
            </Text>

            <Text style={styles.inputLabel}>Mac Wi-Fi IP Address:</Text>
            <TextInput
              style={styles.textInput}
              value={customHostInput}
              onChangeText={setCustomHostInput}
              placeholder="e.g. 172.16.36.36"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.configButtonRow}>
              <TouchableOpacity
                style={styles.configCancelBtn}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.configCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.configSaveBtn}
                onPress={() => {
                  const cleaned = customHostInput.trim();
                  if (cleaned) {
                    setServerHost(cleaned);
                    setWebViewError(null);
                    setShowConfigModal(false);
                    // Re-register push token with new backend URL
                    if (expoPushToken) {
                      registerWithBackend(expoPushToken, linkedProfile);
                    }
                  }
                }}
              >
                <Text style={styles.configSaveBtnText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notifications & Alarms Feed Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.configModalCard, { maxHeight: '80%' }]}>
            <View style={styles.historyHeader}>
              <Text style={styles.configModalTitle}>🔔 Alarms & Alerts Stream</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C355E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2B4A78',
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
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#26426E',
    position: 'relative',
  },
  iconButtonText: {
    fontSize: 16,
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
  errorEmoji: {
    fontSize: 52,
    marginBottom: 16,
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
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  alarmEmoji: {
    fontSize: 38,
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
    maxWidth: 380,
  },
  configModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  configModalSub: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 18,
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
    marginBottom: 20,
    backgroundColor: '#F8FAFC',
  },
  configButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  configCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  configCancelBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  configSaveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1C355E',
    alignItems: 'center',
  },
  configSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
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

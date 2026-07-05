import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Deposit } from './storage';

// Configure how notifications should behave when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function syncNotifications(
  deposits: Deposit[],
  toggles: { maturityReminders: boolean; rdInstallmentReminders: boolean }
) {
  if (Platform.OS === 'web') return;

  // Clear all previously scheduled notifications to prevent duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  const now = new Date();

  for (const deposit of deposits) {
    if (deposit.status !== 'active') continue;

    // 1. Maturity Reminders
    if (toggles.maturityReminders && deposit.maturity_date) {
      const maturityDate = new Date(deposit.maturity_date);
      
      // Schedule reminder 3 days before maturity
      const threeDaysBefore = new Date(maturityDate);
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
      threeDaysBefore.setHours(9, 0, 0, 0); // 9:00 AM

      if (threeDaysBefore > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upcoming Maturity 📈',
            body: `Your ${deposit.type} (${deposit.bank}) for ${deposit.family_member_name} will mature in 3 days.`,
            data: { depositId: deposit.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: threeDaysBefore },
        });
      }

      // Schedule reminder ON maturity day
      const maturityDay = new Date(maturityDate);
      maturityDay.setHours(9, 0, 0, 0); // 9:00 AM
      
      if (maturityDay > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Deposit Matured! 🎉',
            body: `Your ${deposit.type} (${deposit.bank}) has reached maturity today.`,
            data: { depositId: deposit.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: maturityDay },
        });
      }
    }

    // 2. RD Installment Reminders
    if (toggles.rdInstallmentReminders && deposit.type === 'RD' && deposit.start_date) {
      const startDate = new Date(deposit.start_date);
      const installmentDay = startDate.getDate();
      
      // Calculate next installment date
      let nextInstallment = new Date(now.getFullYear(), now.getMonth(), installmentDay, 9, 0, 0, 0);
      
      // If the date has already passed this month, schedule for next month
      if (nextInstallment <= now) {
        nextInstallment.setMonth(nextInstallment.getMonth() + 1);
      }
      
      // Check if the next installment is before or on the maturity date
      const maturityDate = deposit.maturity_date ? new Date(deposit.maturity_date) : null;
      if (maturityDate && nextInstallment > maturityDate) {
        continue;
      }

      // Also schedule a reminder for 2 days before the installment is due
      const reminderDate = new Date(nextInstallment);
      reminderDate.setDate(reminderDate.getDate() - 2);

      if (reminderDate > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'RD Installment Due Soon ⏳',
            body: `Installment for your RD at ${deposit.bank} is due in 2 days.`,
            data: { depositId: deposit.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminderDate },
        });
      }

      if (nextInstallment > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'RD Installment Due Today 📅',
            body: `Don't forget to pay your RD installment at ${deposit.bank} today.`,
            data: { depositId: deposit.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: nextInstallment },
        });
      }
    }
  }
}

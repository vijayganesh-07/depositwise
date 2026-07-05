import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

export default function PrivacyPolicy() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy for DepositWise</Text>
      <Text style={styles.date}>Last Updated: July 2026</Text>

      <Text style={styles.paragraph}>
        Welcome to DepositWise! Your privacy is critically important to us. This Privacy Policy outlines how your personal information and data are handled when you use our mobile application ("DepositWise").
      </Text>

      <Text style={styles.sectionTitle}>1. Data We Collect and How We Use It</Text>
      <Text style={styles.paragraph}>
        DepositWise is designed to be privacy-first.
      </Text>
      <Text style={styles.listItem}>
        • Financial Data: All data regarding your Fixed Deposits (FDs) and Recurring Deposits (RDs), including amounts, bank names, and maturity dates, is stored locally on your device. We do not have access to this data, nor is it sent to any central servers owned by us.
      </Text>
      <Text style={styles.listItem}>
        • Google Account Information: If you choose to enable cloud backups, the app requests basic profile information (Name, Email, Profile Picture) strictly to display your logged-in status within the app settings.
      </Text>

      <Text style={styles.sectionTitle}>2. Google Drive Integration (OAuth)</Text>
      <Text style={styles.paragraph}>
        DepositWise offers an optional backup feature using Google Drive.
      </Text>
      <Text style={styles.listItem}>
        • Required Permissions: To enable backups, the app requests access to the Google Drive file scope.
      </Text>
      <Text style={styles.listItem}>
        • How it is Used: This permission strictly allows DepositWise to create, read, and overwrite a specific backup file containing your deposit data in your personal Google Drive.
      </Text>
      <Text style={styles.listItem}>
        • Data Security: DepositWise cannot see, read, or access any other files, photos, or documents in your Google Drive. The app only interacts with the specific backup file that it creates.
      </Text>
      <Text style={styles.listItem}>
        • Your use of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.
      </Text>

      <Text style={styles.sectionTitle}>3. Data Sharing</Text>
      <Text style={styles.paragraph}>
        We do not sell, rent, or share your personal information or financial data with any third parties. Because your data is stored locally and in your personal Google Drive, we do not possess any of your data to share.
      </Text>

      <Text style={styles.sectionTitle}>4. Security</Text>
      <Text style={styles.paragraph}>
        We take security seriously. DepositWise includes optional on-device security features (like App Lock via Biometrics/PIN) to protect your local data from unauthorized physical access.
      </Text>

      <Text style={styles.sectionTitle}>5. Contact Us</Text>
      <Text style={styles.paragraph}>
        If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact the developer.
      </Text>
      
      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    padding: 24,
  },
  title: {
    fontFamily: typography.bold,
    fontSize: 28,
    color: colors.text1,
    marginBottom: 8,
  },
  date: {
    fontFamily: typography.regular,
    fontSize: 14,
    color: colors.text3,
    marginBottom: 32,
  },
  sectionTitle: {
    fontFamily: typography.semiBold,
    fontSize: 20,
    color: colors.text1,
    marginTop: 24,
    marginBottom: 12,
  },
  paragraph: {
    fontFamily: typography.regular,
    fontSize: 16,
    color: colors.text2,
    marginBottom: 16,
    lineHeight: 24,
  },
  listItem: {
    fontFamily: typography.regular,
    fontSize: 16,
    color: colors.text2,
    marginBottom: 12,
    lineHeight: 24,
    paddingLeft: 12,
  },
  footer: {
    height: 40,
  }
});

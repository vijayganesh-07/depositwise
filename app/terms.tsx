import React from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

export default function TermsOfService() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.date}>Last Updated: July 2026</Text>

      <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
      <Text style={styles.paragraph}>
        By downloading and using DepositWise, you agree to these Terms of Service. If you disagree with any part of the terms, you may not use the application.
      </Text>

      <Text style={styles.sectionTitle}>2. Service Description</Text>
      <Text style={styles.paragraph}>
        DepositWise is a personal finance utility app designed to help users track their Fixed Deposits and Recurring Deposits, calculate estimated returns, and receive maturity reminders.
      </Text>

      <Text style={styles.sectionTitle}>3. No Financial Advice</Text>
      <Text style={styles.paragraph}>
        The calculations, estimated returns, and data presented by DepositWise are for informational and organizational purposes only. DepositWise does not provide professional financial, tax, or legal advice. You should verify all maturity amounts and interest rates directly with your banking institution. We are not liable for any discrepancies between the app's estimates and your bank's actual payouts.
      </Text>

      <Text style={styles.sectionTitle}>4. User Responsibilities</Text>
      <Text style={styles.listItem}>
        • Data Accuracy: You are responsible for the accuracy of the data you input into the app.
      </Text>
      <Text style={styles.listItem}>
        • Account Security: You are responsible for maintaining the security of your device, your App Lock PIN, and your Google account used for backups.
      </Text>

      <Text style={styles.sectionTitle}>5. Disclaimer of Warranties</Text>
      <Text style={styles.paragraph}>
        DepositWise is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, expressed or implied, regarding the app's flawless operation, data retention, or exact accuracy of financial calculations.
      </Text>

      <Text style={styles.sectionTitle}>6. Changes to Terms</Text>
      <Text style={styles.paragraph}>
        We reserve the right to modify or replace these Terms at any time. Continued use of the app after any changes constitutes acceptance of the new Terms.
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

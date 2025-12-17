import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../styles/theme';

export default function WalletRechargeModal({
  visible,
  title = 'Wallet Recharge Required',
  subtitle = 'Insufficient wallet balance',
  note = '',
  currentBalance = 0,
  requiredAmount = 50,
  onAddMoney,
  onCancel,
  primaryLabel = 'Add Money',
  secondaryLabel = 'Maybe Later',
}) {
  return (
    <Modal visible={visible} transparent onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.card} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerDanger}>
            <Ionicons name="wallet-outline" size={28} color={colors.white} />
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {!!note && <Text style={styles.note}>{note}</Text>}

            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Current</Text>
              <Text style={styles.kvValue}>₹{Number(currentBalance || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.kvRow}>
              <Text style={styles.kvLabel}>Required</Text>
              <Text style={styles.kvValue}>₹{Number(requiredAmount || 0).toFixed(2)}</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnSecondary} onPress={onCancel}>
                <Text style={styles.btnSecondaryText}>{secondaryLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={onAddMoney}>
                <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: colors.danger,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  body: {
    padding: 16,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 10,
  },
  note: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
    marginBottom: 12,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  kvLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray600,
  },
  kvValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnSecondaryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  btnPrimaryText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
});

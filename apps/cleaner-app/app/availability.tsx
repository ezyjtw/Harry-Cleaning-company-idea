import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, DaysOfWeek } from '@rena/shared';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface DayAvailability {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export default function AvailabilityScreen() {
  const { api } = useAuth();
  const { data: availability, refetch } = useApi(() => api.getAvailability(), []);

  const [days, setDays] = useState<DayAvailability[]>(
    DaysOfWeek.map((_, i) => {
      const existing = availability?.slots?.find((s) => s.dayOfWeek === i);
      return {
        enabled: !!existing,
        startTime: existing?.startTime ?? '09:00',
        endTime: existing?.endTime ?? '17:00',
      };
    })
  );

  const [blockedDate, setBlockedDate] = useState('');
  const [blockedReason, setBlockedReason] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleDay = (index: number) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], enabled: !newDays[index].enabled };
    setDays(newDays);
  };

  const updateTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newDays = [...days];
    newDays[index] = { ...newDays[index], [field]: value };
    setDays(newDays);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const slots = days
        .map((day, i) => ({ dayOfWeek: i, startTime: day.startTime, endTime: day.endTime }))
        .filter((_, i) => days[i].enabled);

      const overrides = blockedDate
        ? [{ date: blockedDate, isBlocked: true, reason: blockedReason || undefined }]
        : [];

      await api.updateAvailability({ slots, overrides });
      await refetch();
      Alert.alert('Saved', 'Your availability has been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Weekly Schedule</Text>
      <Text style={styles.subheader}>Set when you're available to accept jobs</Text>

      {DaysOfWeek.map((day, i) => (
        <Card key={day} style={styles.dayCard}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayName}>{day}</Text>
            <Switch
              value={days[i]?.enabled ?? false}
              onValueChange={() => toggleDay(i)}
              trackColor={{ true: Colors.primaryDark }}
            />
          </View>
          {days[i]?.enabled && (
            <View style={styles.timeRow}>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>From</Text>
                <Input
                  value={days[i].startTime}
                  onChangeText={(v) => updateTime(i, 'startTime', v)}
                  placeholder="09:00"
                />
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.timeLabel}>To</Text>
                <Input
                  value={days[i].endTime}
                  onChangeText={(v) => updateTime(i, 'endTime', v)}
                  placeholder="17:00"
                />
              </View>
            </View>
          )}
        </Card>
      ))}

      {/* Blocked Dates */}
      <Text style={[styles.header, { marginTop: 24 }]}>Block a Date</Text>
      <Card style={styles.blockCard}>
        <Input
          label="Date (DD/MM/YYYY)"
          placeholder="25/04/2026"
          value={blockedDate}
          onChangeText={setBlockedDate}
        />
        <Input
          label="Reason (optional)"
          placeholder="Holiday, Personal..."
          value={blockedReason}
          onChangeText={setBlockedReason}
        />
      </Card>

      {/* Existing Blocked Dates */}
      {availability?.overrides && availability.overrides.length > 0 && (
        <>
          <Text style={styles.subheader}>Blocked Dates</Text>
          {availability.overrides.map((override) => (
            <View key={override.id} style={styles.blockedRow}>
              <Ionicons name="close-circle" size={18} color={Colors.error} />
              <Text style={styles.blockedDate}>{override.date}</Text>
              <Text style={styles.blockedReason}>{override.reason || 'Blocked'}</Text>
            </View>
          ))}
        </>
      )}

      <Button
        title="Save Availability"
        onPress={handleSave}
        loading={saving}
        size="lg"
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  header: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subheader: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 16 },
  dayCard: { marginBottom: 8 },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayName: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  timeRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  timeInput: { flex: 1 },
  timeLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  blockCard: { marginBottom: 16 },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  blockedDate: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  blockedReason: { fontSize: 13, color: Colors.textMuted },
});

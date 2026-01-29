import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';

export default function ModalTest() {
  const [visible, setVisible] = useState(false);
  
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={() => setVisible(true)}>
        <Text style={styles.buttonText}>Open Modal</Text>
      </TouchableOpacity>
      
      <Modal visible={visible} animationType="slide">
        <View style={styles.modalContent}>
          <Text style={styles.title}>Modal is Working!</Text>
          <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  button: { backgroundColor: '#D4AF37', padding: 20, borderRadius: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  modalContent: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  title: { color: '#D4AF37', fontSize: 24, marginBottom: 20 },
  closeButton: { backgroundColor: '#e63946', padding: 15, borderRadius: 10 },
});

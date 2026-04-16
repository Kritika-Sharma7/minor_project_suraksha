import os
import numpy as np
from scipy.io import wavfile

def generate_noise(length_seconds, sr):
    return np.random.normal(0, 0.1, int(sr * length_seconds)).astype(np.float32)

def generate_scream(length_seconds, sr):
    t = np.linspace(0, length_seconds, int(sr * length_seconds), False)
    # High frequency fundamental (1500 Hz) + harmonics + strong noise
    wave = np.sin(2 * np.pi * 1500 * t) + 0.5 * np.sin(2 * np.pi * 3000 * t)
    noise = np.random.normal(0, 0.5, len(t))
    signal = wave + noise
    # Apply envelope to avoid clicking and simulate burst
    envelope = np.exp(-t * 2) 
    signal = signal * envelope
    # Normalize to quite loud
    signal = signal / np.max(np.abs(signal)) * 0.9
    return signal.astype(np.float32)

def generate_distress(length_seconds, sr):
    t = np.linspace(0, length_seconds, int(sr * length_seconds), False)
    # Mid-range frequency (800 Hz) with vibrato (stress)
    vibrato = np.sin(2 * np.pi * 8 * t) * 50
    wave = np.sin(2 * np.pi * (800 + vibrato) * t)
    noise = np.random.normal(0, 0.2, len(t))
    signal = wave + noise
    signal = signal / np.max(np.abs(signal)) * 0.7
    return signal.astype(np.float32)

def generate_normal(length_seconds, sr):
    # Just quiet background noise
    noise = np.random.normal(0, 0.05, int(sr * length_seconds))
    return noise.astype(np.float32)

def main():
    sr = 22050
    base_dir = "dataset"
    classes = ["scream", "distress", "normal", "fight"]
    
    for c in classes:
        os.makedirs(os.path.join(base_dir, c), exist_ok=True)
        
    num_samples = 30
    
    for i in range(num_samples):
        length = np.random.uniform(1.5, 3.0)
        
        # Scream
        s_scream = generate_scream(length, sr)
        wavfile.write(os.path.join(base_dir, "scream", f"scream_{i}.wav"), sr, s_scream)
        
        # Distress
        s_distress = generate_distress(length, sr)
        wavfile.write(os.path.join(base_dir, "distress", f"distress_{i}.wav"), sr, s_distress)
        
        # Normal
        s_normal = generate_normal(length, sr)
        wavfile.write(os.path.join(base_dir, "normal", f"normal_{i}.wav"), sr, s_normal)
        
        # Fight (similar to distress + noise)
        s_fight = generate_distress(length, sr) + generate_noise(length, sr)
        s_fight = s_fight / np.max(np.abs(s_fight)) * 0.8
        wavfile.write(os.path.join(base_dir, "fight", f"fight_{i}.wav"), sr, s_fight)

    print("Synthetic data generated.")
    
    # Train the model using the built-in function
    print("Training model...")
    from audio_ml import train_and_save_model
    train_and_save_model(base_dir)

if __name__ == "__main__":
    main()

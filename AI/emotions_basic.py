import cv2
import numpy as np
from openvino.runtime import Core

# Path to the downloaded IR model files
MODEL_XML = "intel/emotions-recognition-retail-0003/FP32/emotions-recognition-retail-0003.xml"
MODEL_BIN = "intel/emotions-recognition-retail-0003/FP32/emotions-recognition-retail-0003.bin"

# Emotion labels
EMOTIONS = ["neutral", "happy", "sad", "surprise", "anger"]

# Load OpenVINO model
ie = Core()
model = ie.read_model(model=MODEL_XML)
compiled_model = ie.compile_model(model=model, device_name="CPU")
input_layer = compiled_model.input(0)
output_layer = compiled_model.output(0)

# Load face detector (Haar cascade)
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# Start webcam
cap = cv2.VideoCapture(0)
print("Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret:
        break
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    for (x, y, w, h) in faces:
        face_img = frame[y:y+h, x:x+w]
        face_img = cv2.resize(face_img, (64, 64))
        face_img = face_img.transpose((2, 0, 1))  # HWC to CHW
        face_img = np.expand_dims(face_img, axis=0)
        face_img = face_img.astype(np.float32)
        # Run inference
        result = compiled_model([face_img])[output_layer]
        emotion_idx = np.argmax(result)
        emotion_label = EMOTIONS[emotion_idx]
        # Show all probabilities
        for i, prob in enumerate(result[0]):
            text = f"{EMOTIONS[i]}: {float(prob):.2f}"
            cv2.putText(frame, text, (x, y + h + 25 + i*20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)
        # Draw rectangle and main emotion
        cv2.rectangle(frame, (x, y), (x+w, y+h), (0,255,0), 2)
        cv2.putText(frame, f"Main: {emotion_label}", (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0,255,0), 2)
    cv2.imshow("OpenVINO Emotion Detection", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
cap.release()
cv2.destroyAllWindows()
from flask import Flask, request, jsonify
import cv2
import numpy as np
import base64
from keras.models import load_model
# from keras.preprocessing.image import img_to_array
from tensorflow.keras.utils import img_to_array

from openvino.runtime import Core
from flask_cors import CORS

# =====================
# Initialize Flask App
# =====================
app = Flask(__name__)
CORS(app)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# =====================
# Load Models
# =====================
EMOTIONS = ["neutral", "happy", "sad", "surprise", "anger"]
ov_model_xml = "intel/emotions-recognition-retail-0003/FP32/emotions-recognition-retail-0003.xml"

ie = Core()
ov_model = ie.read_model(model=ov_model_xml)
ov_compiled_model = ie.compile_model(model=ov_model, device_name="CPU")
ov_input_layer = ov_compiled_model.input(0)
ov_output_layer = ov_compiled_model.output(0)

# keras_model = load_model('./emotion_model.h5')
keras_model = load_model('./emotion_model.h5', compile=False)


face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

# =====================
# Helper: Decode base64 Image
# =====================
def decode_image(image_data):
    nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

# =====================
# API Route
# =====================
@app.route('/predict', methods=['POST'])
def predict():
    data = request.json
    if "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    frame = decode_image(data["image"])
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)

    results = []
    for (x, y, w, h) in faces:
        face_img = frame[y:y+h, x:x+w]
        face_gray = gray[y:y+h, x:x+w]

        # Binary Confusion Model (Keras)
        resized_gray = cv2.resize(face_gray, (48, 48), interpolation=cv2.INTER_AREA)
        if np.sum([resized_gray]) != 0:
            face_array = resized_gray.astype('float') / 255.0
            face_array = img_to_array(face_array)
            face_array = np.expand_dims(face_array, axis=0)
            prediction = keras_model.predict(face_array)[0][0]
            binary_label = 'Confused' if prediction > 0.5 else 'Not Confused'
        else:
            binary_label = 'Face not clear'

        # OpenVINO Multi-Emotion Model
        resized_ov = cv2.resize(face_img, (64, 64))
        ov_input = resized_ov.transpose((2, 0, 1))  # HWC to CHW
        ov_input = np.expand_dims(ov_input, axis=0).astype(np.float32)
        ov_result = ov_compiled_model([ov_input])[ov_output_layer]
        probs = [float(p) for p in ov_result[0]]
        main_emotion = EMOTIONS[np.argmax(probs)]

        results.append({
            "box": [int(x), int(y), int(w), int(h)],
            "main_emotion": main_emotion,
            "probabilities": dict(zip(EMOTIONS, probs)),
            "confusion": binary_label
        })

    return jsonify({"faces": results})

# =====================
# Run App
# =====================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

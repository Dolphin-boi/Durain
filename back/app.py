from flask import Flask, request, jsonify, send_from_directory
from model import predict_image, predict_video
from flask_cors import CORS
import os

UPLOAD_FOLDER = "image"
VIDEO_FOLDER = "video"
ALLOW_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif', 'webp'])
VIDEO_EXTENSIONS = set(['mp4', 'mov', 'avi'])

os.makedirs(VIDEO_FOLDER, exist_ok=True)

def allowed_image_file(filename):
    if '.' not in filename:
        return False
    parts = filename.rsplit('.', 1)
    extension = parts[1].lower()
    return extension in ALLOW_EXTENSIONS

def allowed_video_file(filename):
    if '.' not in filename:
        return False
    extension = filename.rsplit('.', 1)[1].lower()
    return extension in VIDEO_EXTENSIONS

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['VIDEO_FOLDER'] = VIDEO_FOLDER

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error' : 'file missing'}), 400
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error' : 'no file uploaded'}), 400
    
    if file and allowed_image_file(file.filename):
        
        model_name = request.form.get('model')
        (prediction_result, img) = predict_image(file, model_name)

        if "Error during prediction" in prediction_result:
            return jsonify({
                'msg': 'Prediction failed',
                'error': prediction_result
            }), 500
        else:
            return jsonify({
                'msg': prediction_result,
                'filename': file.filename,
                'predicted_image': img
            })
        
    else:
        return jsonify({'error' : 'File type not allowed'}), 400
    
@app.route('/upload_video', methods=['POST'])
def upload_video():
    if 'file' not in request.files:
        return jsonify({'error' : 'file missing'}), 400
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error' : 'no file uploaded'}), 400
    
    if file and allowed_video_file(file.filename):
        
        model_name = request.form.get('model')
        (prediction_result, filepath) = predict_video(file, model_name, VIDEO_FOLDER)

        if filepath:
            return jsonify({
                'msg': prediction_result,
                'video_filename': filepath
            })
        else:
            return jsonify({
                'msg': 'Prediction failed',
                'error': prediction_result
            }), 500
        
    else:
        return jsonify({'error' : 'File type not allowed'}), 400

@app.route('/video/<filename>')
def serve_video(filename):
    return send_from_directory(VIDEO_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
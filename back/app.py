from flask import Flask, request, jsonify
from model import predict_image
from flask_cors import CORS

UPLOAD_FOLDER = "image"
ALLOW_EXTENSIONS = set(['png', 'jpg', 'jpeg', 'gif', 'webp'])

def allowed_file(filename):
    if '.' not in filename:
        return False
    parts = filename.rsplit('.', 1)
    extension = parts[1].lower()

    return extension in ALLOW_EXTENSIONS

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error' : 'file missing'}), 400
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error' : 'no file uploaded'}), 400
    
    if file and allowed_file(file.filename):
        
        # prediction_result = predict_image(file)
        
        # return jsonify({
        #     'msg' : 'Prediction success',
        #     'filename': file.filename,
        #     'prediction': prediction_result
        # })
        
        prediction_result = predict_image(file)

        if prediction_result == "No object detected":
            return jsonify({
                'msg': 'Prediction success',
                'filename': file.filename,
                'prediction': prediction_result # ยังคงคืนค่าข้อความนี้ถ้าไม่พบวัตถุ
            })
        elif "Error during prediction" in prediction_result:
            return jsonify({
                'msg': 'Prediction failed',
                'error': prediction_result
            }), 500
        else:
            # ถ้ามีรูปภาพ base64 กลับมา
            return jsonify({
                'msg': 'Prediction success with image',
                'filename': file.filename,
                'predicted_image': prediction_result # นี่คือ base64 string ของรูปภาพ
            })
        
    else:
        return jsonify({'error' : 'File type not allowed'}), 400
if __name__ == '__main__':
    app.run(debug=True, port=5000)
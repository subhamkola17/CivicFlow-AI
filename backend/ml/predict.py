import sys
import json
import joblib


# ==========================================
# LOAD TRAINED MODEL PACKAGE
# ==========================================

model_package = joblib.load("ml/queue_prediction_model.pkl")

model = model_package["model"]
reliability = model_package["reliability"]
mae = model_package["mae"]
r2 = model_package["r2"]


# ==========================================
# READ JSON INPUT
# ==========================================

input_data = sys.stdin.read().strip()

if not input_data:
    print(json.dumps({
        "success": False,
        "error": "No input data provided"
    }))
    sys.exit(1)


data = json.loads(input_data)


# ==========================================
# GET INPUT VALUES
# ==========================================

current_queue = float(data["currentQueue"])
arrival_rate = float(data["arrivalRate"])
processing_time = float(data["processingTime"])
staff_count = float(data["staffCount"])


# ==========================================
# PREPARE FEATURES
# ==========================================

features = [[
    current_queue,
    arrival_rate,
    processing_time,
    staff_count
]]


# ==========================================
# PREDICT 30-MINUTE QUEUE
# ==========================================

prediction_30 = float(
    model.predict(features)[0]
)


# ==========================================
# PREDICT 60-MINUTE QUEUE
# ==========================================

features_60 = [[
    prediction_30,
    arrival_rate,
    processing_time,
    staff_count
]]

prediction_60 = float(
    model.predict(features_60)[0]
)


# ==========================================
# PREVENT NEGATIVE QUEUE VALUES
# ==========================================

prediction_30 = max(0, prediction_30)
prediction_60 = max(0, prediction_60)


# ==========================================
# RETURN ML RESULTS
# ==========================================

result = {
    "success": True,

    "predictedQueueAfter30Min": round(
        prediction_30,
        2
    ),

    "predictedQueueAfter60Min": round(
        prediction_60,
        2
    ),

    "reliability": round(
        reliability,
        2
    ),

    "mae": round(
        mae,
        2
    ),

    "r2": round(
        r2,
        4
    )
}


print(json.dumps(result))
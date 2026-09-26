import pandas as pd
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score


# ==========================================
# TRAINING DATA
# ==========================================

data = {
    "currentQueue": [
        10, 15, 20, 25, 30,
        35, 40, 45, 50, 55,
        60, 65, 70, 75, 80,
        85, 90, 95, 100, 110,
        120, 130, 140, 150, 160,
        170, 180, 190, 200, 220,
        240, 260, 280, 300, 320,
        340, 360, 380, 400, 450
    ],

    "arrivalRate": [
        3, 4, 5, 6, 7,
        8, 9, 10, 11, 12,
        13, 14, 15, 16, 17,
        18, 19, 20, 21, 22,
        23, 24, 25, 26, 27,
        28, 29, 30, 31, 32,
        33, 34, 35, 36, 37,
        38, 39, 40, 42, 45
    ],

    "processingTime": [
        4, 5, 5, 6, 6,
        7, 7, 8, 8, 9,
        9, 10, 10, 11, 11,
        12, 12, 13, 13, 14,
        14, 15, 15, 16, 16,
        17, 17, 18, 18, 19,
        19, 20, 20, 21, 21,
        22, 22, 23, 24, 25
    ],

    "staffCount": [
        5, 5, 4, 4, 4,
        4, 3, 3, 3, 3,
        3, 3, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        2, 2, 2, 2, 2,
        1, 1, 1, 1, 1,
        1, 1, 1, 1, 1
    ],

    "queueAfter30Min": [
        14, 20, 27, 33, 39,
        46, 52, 59, 65, 72,
        78, 85, 92, 99, 106,
        113, 120, 128, 135, 143,
        151, 159, 167, 175, 183,
        191, 199, 207, 215, 224,
        233, 242, 251, 260, 269,
        278, 287, 296, 310, 325
    ]
}


# ==========================================
# CREATE DATAFRAME
# ==========================================

df = pd.DataFrame(data)


# ==========================================
# FEATURES AND TARGET
# ==========================================

X = df[
    [
        "currentQueue",
        "arrivalRate",
        "processingTime",
        "staffCount"
    ]
]

y = df["queueAfter30Min"]


# ==========================================
# TRAIN / TEST SPLIT
# ==========================================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42
)


# ==========================================
# RANDOM FOREST MODEL
# ==========================================

model = RandomForestRegressor(
    n_estimators=100,
    random_state=42
)


# ==========================================
# TRAIN MODEL
# ==========================================

model.fit(X_train, y_train)


# ==========================================
# VALIDATION
# ==========================================

predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)


# ==========================================
# MODEL RELIABILITY SCORE
# ==========================================

# Convert R² into a percentage-style reliability
# score for display in the application.

reliability = max(0, min(100, r2 * 100))


# ==========================================
# SAVE MODEL + METRICS
# ==========================================

model_package = {
    "model": model,
    "reliability": round(reliability, 2),
    "mae": round(mae, 2),
    "r2": round(r2, 4)
}

joblib.dump(
    model_package,
    "ml/queue_prediction_model.pkl"
)


# ==========================================
# DISPLAY RESULTS
# ==========================================

print("==========================================")
print("ML MODEL TRAINED SUCCESSFULLY")
print("==========================================")

print(f"Validation MAE: {mae:.2f}")
print(f"Validation R2: {r2:.4f}")
print(f"Model Reliability: {reliability:.2f}%")

print("==========================================")
print("Model saved as:")
print("ml/queue_prediction_model.pkl")
print("==========================================")
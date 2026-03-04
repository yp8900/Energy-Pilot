# ML/AI Integration Roadmap for Predictive Analytics

## Executive Summary

This document outlines the strategy for enhancing the Energy-Pilot Predictive Analytics module with Machine Learning and AI capabilities. The current system uses statistical methods (exponential smoothing, linear regression); ML integration will provide adaptive learning, multi-factor predictions, and self-improving accuracy.

**Expected Improvements:**
- Forecast accuracy: 70-75% → 90-95%
- Multi-factor analysis: Weather, occupancy, production schedules
- Anomaly detection precision: 60% → 85%+
- Cost savings potential: 25-35% through optimized predictions

---

## 📊 Current State vs. ML Enhancement

### Current Implementation (Statistical Methods)

**Algorithms Used:**
- **Exponential Smoothing** for time series forecasting
- **Linear Regression** for trend analysis
- **Threshold-based Rules** for anomaly detection
- **Hardcoded Patterns** for time-of-day/weekday detection

**Limitations:**
- ❌ Cannot adapt to changing patterns automatically
- ❌ Single-factor predictions (only historical consumption)
- ❌ Linear assumptions don't capture complex relationships
- ❌ Manual threshold tuning required
- ❌ No feature importance analysis

### ML/AI Enhancement Benefits

**Capabilities Added:**
- ✅ **Adaptive Learning:** Models improve from new data automatically
- ✅ **Multi-Factor Predictions:** Weather, occupancy, schedules, holidays
- ✅ **Non-Linear Patterns:** Captures complex energy consumption relationships
- ✅ **Self-Healing:** Detects model drift and triggers retraining
- ✅ **Explainable AI:** Understanding why predictions were made
- ✅ **What-If Analysis:** Simulate scenarios before implementation

---

## 🏗️ Architecture Options

### Option 1: Lightweight On-Premise (Recommended for Phase 1)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Historical Data │────▶│ Feature Engineer │────▶│  ML Model       │
│   (TimescaleDB) │     │   (Node.js/Py)   │     │  (ONNX Runtime) │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │  Predictions    │
                                                  │  (Real-time)    │
                                                  └─────────────────┘
```

**Technology Stack:**
- **Training:** Python (Prophet/TensorFlow) - Offline batch processing
- **Inference:** ONNX.js runtime in Node.js backend
- **Storage:** Export trained models as `.onnx` files
- **Deployment:** No external dependencies, runs on-premise

**Pros:**
- ✅ Complete data privacy (no cloud dependency)
- ✅ Low latency inference (<50ms)
- ✅ Cost-effective (no API charges)
- ✅ Easy deployment (single server)

**Cons:**
- ⚠️ Manual model retraining orchestration
- ⚠️ Limited to simpler models (size constraints)
- ⚠️ Requires Python environment for training

---

### Option 2: Cloud ML Service Integration

```
┌────────────────┐     ┌──────────────────────┐     ┌────────────────┐
│  Energy Data   │────▶│  Cloud ML Platform   │────▶│  Predictions   │
│  (via API)     │     │  - AWS SageMaker     │     │  (REST API)    │
└────────────────┘     │  - Azure ML          │     └────────────────┘
                       │  - Google AutoML     │
                       └──────────────────────┘
```

**Service Options:**

**Azure Machine Learning:**
- Time Series Forecasting (AutoML)
- Managed endpoints with auto-scaling
- Built-in monitoring and retraining

**AWS Forecast:**
- Purpose-built for time series
- DeepAR+ algorithm (RNN-based)
- Automatic feature engineering

**Google Cloud AutoML Tables:**
- No-code ML model training
- Automatic hyperparameter tuning
- Explainable AI built-in

**Pros:**
- ✅ Managed infrastructure (no DevOps overhead)
- ✅ Advanced algorithms (LSTM, Transformer, DeepAR)
- ✅ Automatic retraining pipelines
- ✅ Scales to thousands of meters
- ✅ Enterprise-grade monitoring

**Cons:**
- ⚠️ Monthly costs (API usage + compute)
- ⚠️ Data leaves premises (privacy concerns)
- ⚠️ Internet dependency for predictions
- ⚠️ Vendor lock-in

---

### Option 3: Hybrid Architecture (Best of Both Worlds)

```
┌─────────────────────────────────────────────────────────────┐
│                    TRAINING LAYER (Python)                   │
│  ┌──────────────┐   ┌─────────────┐   ┌─────────────────┐  │
│  │ Data Pipeline│──▶│ ML Training │──▶│  Model Export   │  │
│  │  (Batch Job) │   │ (TF/PyTorch)│   │  (.onnx/.pkl)   │  │
│  └──────────────┘   └─────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼ Model Files
┌─────────────────────────────────────────────────────────────┐
│                 INFERENCE LAYER (Node.js)                    │
│  ┌──────────────┐   ┌─────────────┐   ┌─────────────────┐  │
│  │ ONNX Runtime │◀──│ Model Cache │◀──│  API Endpoints  │  │
│  │  (Real-time) │   │   (Redis)   │   │   (Express)     │  │
│  └──────────────┘   └─────────────┘   └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Workflow:**
1. **Offline Training:** Python service trains models weekly (scheduled job)
2. **Model Export:** Convert to ONNX format for cross-platform inference
3. **Deployment:** Load models into Node.js backend
4. **Real-time Inference:** Sub-second predictions using ONNX Runtime
5. **Monitoring:** Track model performance, trigger retraining if accuracy drops

**Pros:**
- ✅ Best of both: Python ML ecosystem + Node.js performance
- ✅ Flexible model complexity
- ✅ Independent scaling of training vs. inference
- ✅ Easy model versioning and rollback

**Recommended Approach:** Start with this for production deployment.

---

## 🤖 ML Models for Energy Forecasting

### 1. LSTM (Long Short-Term Memory Networks)

**Use Case:** Multi-step ahead forecasting (24-hour, 7-day predictions)

**Why it Works:**
- Captures long-term dependencies in time series
- Remembers patterns from weeks/months ago
- Handles multiple input features naturally

**Architecture:**
```python
model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(lookback, features)),
    Dropout(0.2),
    LSTM(64, return_sequences=False),
    Dropout(0.2),
    Dense(24)  # Predict next 24 hours
])
```

**Input Features:**
- Historical consumption (past 168 hours = 7 days)
- Hour of day (0-23)
- Day of week (0-6)
- Is weekend/holiday (boolean)
- Temperature (if available)
- Rolling averages (24h, 7d)

**Expected Accuracy:** 85-92% (MAPE < 10%)

**Training Time:** 2-4 hours on GPU, 8-12 hours on CPU

---

### 2. Prophet (Facebook's Time Series Library)

**Use Case:** Quick deployment, automatic seasonality detection

**Why it Works:**
- Decomposes time series: Trend + Seasonality + Holidays
- Handles missing data gracefully
- Robust to outliers
- Minimal hyperparameter tuning

**Code Example:**
```python
from prophet import Prophet

model = Prophet(
    yearly_seasonality=True,   # Annual patterns
    weekly_seasonality=True,   # Weekday vs. weekend
    daily_seasonality=True,    # Hour-of-day patterns
    holidays=get_indian_holidays(),
    changepoint_prior_scale=0.05
)

model.fit(historical_df)
forecast = model.predict(future_df)
```

**Expected Accuracy:** 80-88% (good starting point)

**Training Time:** 5-15 minutes

**Best For:** Fast POC, seasonal businesses, explainable forecasts

---

### 3. XGBoost / LightGBM (Gradient Boosting)

**Use Case:** Feature importance analysis, anomaly detection

**Why it Works:**
- Ensemble of decision trees
- Handles non-linear relationships
- Provides feature importance scores
- Fast training and inference

**Features Engineering:**
```python
features = [
    'hour', 'day_of_week', 'is_weekend',
    'power_lag_1h', 'power_lag_24h', 'power_lag_168h',
    'power_rolling_mean_24h', 'power_rolling_std_24h',
    'temperature', 'humidity',
    'is_holiday', 'month', 'season'
]
```

**Feature Importance Output:**
```
Hour of day:           35%
Temperature:           25%
Power lag 24h:         18%
Day of week:           12%
Rolling mean 24h:      10%
```

**Expected Accuracy:** 82-90%

**Best For:** Understanding consumption drivers, root cause analysis

---

### 4. Isolation Forest (Anomaly Detection)

**Use Case:** Real-time outlier detection

**Why it Works:**
- Unsupervised learning (no labeled anomalies needed)
- Fast inference (<10ms per prediction)
- Identifies rare patterns automatically

**Implementation:**
```python
from sklearn.ensemble import IsolationForest

model = IsolationForest(
    contamination=0.05,  # Expect 5% anomalies
    random_state=42
)

# Train on normal data
model.fit(normal_readings)

# Detect anomalies in real-time
anomaly_score = model.decision_function(new_reading)
is_anomaly = model.predict(new_reading) == -1
```

**Output:**
- Anomaly score: -0.3 to 0.5 (negative = anomaly)
- Binary classification: Normal / Anomaly
- Confidence level

**Expected Precision:** 80-90% (few false alarms)

---

### 5. Transformer Models (Advanced)

**Use Case:** Complex pattern recognition, multi-meter correlation

**Why it Works:**
- Attention mechanism focuses on relevant time periods
- Captures relationships between multiple meters
- State-of-the-art accuracy

**Model:** Temporal Fusion Transformer (TFT)

**Expected Accuracy:** 92-96% (research-grade)

**Trade-off:** High computational cost, longer training time

**Best For:** Large deployments (100+ meters), maximum accuracy

---

## 📈 Implementation Roadmap

### Phase 1: Data Foundation (Weeks 1-2)

**Objective:** Prepare data pipeline for ML

**Tasks:**
1. **Data Collection Enhancement**
   ```typescript
   interface MLFeatures {
     // Core metrics
     power: number;
     voltage: number;
     current: number;
     timestamp: Date;
     
     // Time features
     hour: number;
     dayOfWeek: number;
     month: number;
     isWeekend: boolean;
     isHoliday: boolean;
     
     // Lag features
     power_lag_1h: number;
     power_lag_24h: number;
     power_lag_168h: number;
     
     // Rolling statistics
     power_rolling_mean_24h: number;
     power_rolling_std_24h: number;
     
     // External factors (optional)
     temperature?: number;
     humidity?: number;
     occupancy?: number;
   }
   ```

2. **Feature Engineering Pipeline**
   - Calculate lag features
   - Compute rolling statistics
   - Add time-based features
   - Integrate weather API (optional)

3. **Data Quality Validation**
   - Handle missing values
   - Remove outliers (>3 standard deviations)
   - Interpolate gaps
   - Validate data consistency

**Deliverable:** Clean, feature-rich dataset (minimum 30 days)

---

### Phase 2: Model Development (Weeks 3-4)

**Objective:** Train and evaluate initial ML models

**Tasks:**
1. **Set up Python ML Environment**
   ```bash
   # Create isolated environment
   python -m venv ml-env
   source ml-env/bin/activate  # Linux/Mac
   ml-env\Scripts\activate     # Windows
   
   # Install dependencies
   pip install prophet tensorflow scikit-learn onnx onnxruntime
   ```

2. **Train Prophet Model (Quick Win)**
   ```python
   # ml-service/train_prophet.py
   from prophet import Prophet
   import pandas as pd
   
   def train_device_model(device_id, historical_data):
       df = pd.DataFrame(historical_data)
       df.rename(columns={'timestamp': 'ds', 'power': 'y'}, inplace=True)
       
       model = Prophet(
           yearly_seasonality=True,
           weekly_seasonality=True,
           daily_seasonality=True
       )
       model.fit(df)
       
       # Evaluate on test set
       metrics = evaluate_model(model, test_data)
       print(f"MAPE: {metrics['mape']:.2f}%")
       
       return model
   ```

3. **Model Evaluation**
   - Split data: 80% train, 20% test
   - Calculate metrics: MAPE, RMSE, R²
   - Compare against current exponential smoothing
   - Visualize predictions vs. actuals

**Deliverable:** Trained Prophet models for each meter, performance report

---

### Phase 3: Model Deployment (Weeks 5-6)

**Objective:** Integrate ML models into Node.js backend

**Tasks:**
1. **Export Models to ONNX**
   ```python
   # Export Prophet to ONNX format
   from prophet.serialize import model_to_json
   import json
   
   # Save model
   with open(f'models/device_{device_id}.json', 'w') as f:
       json.dump(model_to_json(model), f)
   ```

2. **Create ML Service Microservice**
   ```python
   # ml-service/app.py (FastAPI)
   from fastapi import FastAPI
   from prophet import Prophet
   
   app = FastAPI()
   
   @app.post("/api/ml/forecast/{device_id}")
   async def forecast(device_id: int, historical_data: list):
       model = load_model(device_id)
       future = model.make_future_dataframe(periods=24, freq='H')
       forecast = model.predict(future)
       return {
           "predictions": forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].to_dict('records'),
           "model_version": get_model_version(device_id),
           "confidence": calculate_confidence(forecast)
       }
   
   @app.post("/api/ml/detect-anomaly")
   async def detect_anomaly(reading: dict):
       model = load_anomaly_detector()
       score = model.decision_function([reading['features']])[0]
       is_anomaly = score < -0.3
       return {
           "is_anomaly": is_anomaly,
           "anomaly_score": float(score),
           "severity": get_severity(score)
       }
   ```

3. **Integrate with Node.js Backend**
   ```typescript
   // server/analytics/ml-service.ts
   
   export class MLPredictiveService {
     private mlServiceUrl = 'http://localhost:8001/api/ml';
     
     async generateMLForecast(deviceId: number): Promise<MLForecast> {
       const historical = await this.getHistoricalData(deviceId, 30);
       
       const response = await fetch(`${this.mlServiceUrl}/forecast/${deviceId}`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ historical_data: historical })
       });
       
       return await response.json();
     }
     
     async detectAnomalyML(reading: Reading): Promise<AnomalyResult> {
       const features = this.extractFeatures(reading);
       
       const response = await fetch(`${this.mlServiceUrl}/detect-anomaly`, {
         method: 'POST',
         body: JSON.stringify({ features })
       });
       
       return await response.json();
     }
   }
   ```

4. **Docker Compose Configuration**
   ```yaml
   # docker-compose.yml
   services:
     ml-service:
       build: ./ml-service
       ports:
         - "8001:8001"
       environment:
         - MODEL_PATH=/app/models
       volumes:
         - ./models:/app/models
       restart: always
   
     node-backend:
       build: .
       ports:
         - "5000:5000"
       depends_on:
         - ml-service
       environment:
         - ML_SERVICE_URL=http://ml-service:8001
   ```

**Deliverable:** Deployed ML service integrated with existing system

---

### Phase 4: UI Enhancements (Weeks 7-8)

**Objective:** Display ML insights in dashboard

**Tasks:**
1. **ML Model Status Card**
   ```tsx
   function MLModelStatus({ deviceId }: { deviceId: number }) {
     const { data: modelInfo } = useQuery(['ml-model-info', deviceId], 
       () => fetch(`/api/ml/model-info/${deviceId}`).then(r => r.json())
     );
     
     return (
       <Card>
         <CardHeader>
           <CardTitle>🤖 ML Model Performance</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="grid grid-cols-3 gap-4">
             <div>
               <p className="text-sm text-muted-foreground">Accuracy (MAPE)</p>
               <p className="text-2xl font-bold text-green-600">
                 {modelInfo?.accuracy}%
               </p>
             </div>
             <div>
               <p className="text-sm text-muted-foreground">Last Retrained</p>
               <p className="text-sm">{modelInfo?.lastTrained}</p>
             </div>
             <div>
               <p className="text-sm text-muted-foreground">Training Data</p>
               <p className="text-sm">{modelInfo?.dataPoints} readings</p>
             </div>
           </div>
         </CardContent>
       </Card>
     );
   }
   ```

2. **Confidence Intervals Visualization**
   ```tsx
   // Show prediction confidence bands
   <AreaChart data={forecastData}>
     <Area 
       dataKey="yhat_upper" 
       fill="#e0f2fe" 
       stroke="transparent"
       name="Upper Bound (95%)"
     />
     <Area 
       dataKey="yhat_lower" 
       fill="white" 
       stroke="transparent"
       name="Lower Bound (95%)"
     />
     <Line 
       dataKey="yhat" 
       stroke="#3b82f6"
       strokeWidth={3}
       name="ML Prediction"
     />
   </AreaChart>
   ```

3. **Feature Importance Display**
   ```tsx
   function FeatureImportance({ deviceId }: { deviceId: number }) {
     return (
       <Card>
         <CardHeader>
           <CardTitle>📊 Consumption Drivers</CardTitle>
           <CardDescription>
             Factors influencing energy consumption (ML analysis)
           </CardDescription>
         </CardHeader>
         <CardContent>
           <BarChart data={featureImportances}>
             <XAxis dataKey="feature" />
             <YAxis />
             <Bar dataKey="importance" fill="#8b5cf6" />
           </BarChart>
         </CardContent>
       </Card>
     );
   }
   ```

**Deliverable:** Enhanced UI showing ML predictions and insights

---

### Phase 5: Monitoring & Retraining (Ongoing)

**Objective:** Ensure model accuracy over time

**Tasks:**
1. **Model Performance Tracking**
   ```python
   # Track predictions vs. actuals
   def monitor_model_performance():
       for device_id in active_devices:
           predictions = get_predictions(device_id, last_7_days)
           actuals = get_actuals(device_id, last_7_days)
           
           mape = calculate_mape(predictions, actuals)
           
           if mape > THRESHOLD:
               trigger_retraining(device_id)
               send_alert(f"Model accuracy dropped for device {device_id}")
   ```

2. **Automated Retraining Pipeline**
   ```python
   # Scheduled job: Run weekly
   @scheduler.scheduled_job('cron', day_of_week='sun', hour=2)
   def retrain_models():
       for device_id in active_devices:
           latest_data = fetch_data(device_id, last_30_days)
           new_model = train_model(device_id, latest_data)
           
           # A/B test new model
           if evaluate_model(new_model) > evaluate_model(current_model):
               deploy_model(device_id, new_model)
               log_deployment(device_id, new_model.version)
   ```

3. **Alerting on Model Drift**
   - Daily accuracy checks
   - Email alerts when MAPE > 15%
   - Dashboard showing model health

**Deliverable:** Self-maintaining ML system with automatic retraining

---

## 💻 Technology Stack Recommendations

### Minimal Setup (Prototype)
```
Training:     Python + Prophet
Export:       JSON model serialization
Inference:    Prophet in Python microservice
Deployment:   Docker container for ML service
API:          FastAPI (Python) ⇄ Node.js backend
```

**Pros:** Fast to implement (1-2 weeks)

---

### Production Setup (Scalable)
```
Data Pipeline:    Apache Kafka → TimescaleDB
Feature Store:    Feast.dev or custom Redis cache
Training:         Python (TensorFlow/PyTorch) + MLflow
Model Registry:   MLflow Model Registry
Serving:          ONNX Runtime (C++) or TorchServe
Monitoring:       Prometheus + Grafana
Orchestration:    Apache Airflow / Prefect
CI/CD:            GitHub Actions → Docker → K8s
```

**Pros:** Enterprise-grade, scales to 1000+ meters

---

### Cloud-Native (Managed)
```
Training:      Azure ML / AWS SageMaker
Deployment:    Managed endpoints (auto-scaling)
Monitoring:    Built-in metrics dashboards
Retraining:    Scheduled pipelines
API:           REST endpoints → Node.js
```

**Pros:** Minimal DevOps overhead

---

## 🎯 Success Metrics

### Model Performance KPIs

**Forecast Accuracy:**
- **MAPE (Mean Absolute Percentage Error):** < 10% ✅
- **RMSE (Root Mean Square Error):** < 50 kW ✅
- **R² Score:** > 0.85 ✅
- **Direction Accuracy:** > 80% (↑↓ correct) ✅

**Anomaly Detection:**
- **Precision:** > 80% (few false alarms) ✅
- **Recall:** > 90% (catch real issues) ✅
- **F1 Score:** > 0.85 ✅
- **Detection Latency:** < 1 minute ✅

**Business Impact:**
- **Cost Savings:** 25-35% through optimized load shifting
- **Downtime Reduction:** 40% through early anomaly detection
- **Capacity Planning:** 90% forecast accuracy for next month

---

### Monitoring Dashboard Metrics

```
┌────────────────────────────────────────────────────────────┐
│  ML Model Health Dashboard                                 │
├────────────────────────────────────────────────────────────┤
│  Overall Accuracy (Last 7 Days):  92.5%  ✅               │
│  Active Models:                   5 devices                │
│  Models Requiring Retraining:     0                        │
│  Avg Inference Time:              45ms                     │
│  Anomalies Detected (24h):        3                        │
│  False Alarm Rate:                12%                      │
└────────────────────────────────────────────────────────────┘

Device-Level Metrics:
┌─────────────────────┬──────────┬────────────┬──────────────┐
│ Device              │ MAPE     │ Last Train │ Status       │
├─────────────────────┼──────────┼────────────┼──────────────┤
│ EM-MAIN-INCOMER     │ 8.2%     │ 2 days ago │ ✅ Healthy   │
│ EM-HVAC-SYSTEM      │ 11.5%    │ 1 day ago  │ ⚠️ Monitor   │
│ EM-LIGHTING-CIRCUIT │ 6.8%     │ 3 days ago │ ✅ Healthy   │
│ EM-DATA-CENTER      │ 9.1%     │ 2 days ago │ ✅ Healthy   │
│ EM-PRODUCTION-LINE  │ 7.5%     │ 1 day ago  │ ✅ Healthy   │
└─────────────────────┴──────────┴────────────┴──────────────┘
```

---

## 🚀 Quick Win: Prophet Integration (2-Week POC)

### Goal
Replace exponential smoothing with Prophet for immediate 15-20% accuracy improvement.

### Implementation Steps

**Week 1: Python ML Service**

1. **Create ML Service Directory**
   ```bash
   mkdir ml-service && cd ml-service
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install fastapi uvicorn prophet pandas
   ```

2. **Implement Forecast API** (`ml-service/app.py`)
   ```python
   from fastapi import FastAPI
   from prophet import Prophet
   import pandas as pd
   from datetime import datetime, timedelta
   
   app = FastAPI()
   
   @app.post("/forecast")
   async def generate_forecast(device_id: int, data: list):
       # Convert to DataFrame
       df = pd.DataFrame(data)
       df.rename(columns={'timestamp': 'ds', 'power': 'y'}, inplace=True)
       
       # Train Prophet
       model = Prophet(
           yearly_seasonality=False,  # Not enough data
           weekly_seasonality=True,
           daily_seasonality=True,
           changepoint_prior_scale=0.05
       )
       model.fit(df)
       
       # Generate 24h forecast
       future = model.make_future_dataframe(periods=24, freq='H')
       forecast = model.predict(future)
       
       return {
           "predictions": forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(24).to_dict('records'),
           "mape": calculate_mape(df['y'].values[-24:], forecast['yhat'].values[-24:])
       }
   
   def calculate_mape(actual, predicted):
       return (abs((actual - predicted) / actual).mean() * 100).round(2)
   
   if __name__ == "__main__":
       import uvicorn
       uvicorn.run(app, host="0.0.0.0", port=8001)
   ```

3. **Dockerfile**
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY . .
   CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
   ```

**Week 2: Node.js Integration**

4. **Add ML Client** (`server/analytics/ml-client.ts`)
   ```typescript
   export class MLClient {
     private baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
     
     async getForecast(deviceId: number, historicalData: Reading[]): Promise<MLForecast> {
       const response = await fetch(`${this.baseUrl}/forecast`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           device_id: deviceId,
           data: historicalData.map(r => ({
             timestamp: r.timestamp,
             power: r.power
           }))
         })
       });
       
       if (!response.ok) {
         throw new Error(`ML service error: ${response.statusText}`);
       }
       
       return await response.json();
     }
   }
   ```

5. **Update Predictive Routes** (`server/routes.ts`)
   ```typescript
   app.get("/api/predictive/forecast-ml", async (req, res) => {
     try {
       const deviceId = req.query.deviceId ? Number(req.query.deviceId) : undefined;
       const mlClient = new MLClient();
       
       const devices = deviceId 
         ? [await storage.getDevice(deviceId)]
         : await storage.getMeters();
       
       const forecasts = await Promise.all(
         devices.map(async (device) => {
           const historical = await storage.getMeterReadings(device.id, 168);
           return await mlClient.getForecast(device.id, historical);
         })
       );
       
       res.json({ success: true, forecasts });
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   });
   ```

6. **Docker Compose** (update)
   ```yaml
   services:
     ml-service:
       build: ./ml-service
       ports:
         - "8001:8001"
       restart: always
   ```

**Result:** ML-powered forecasts with confidence intervals in 2 weeks!

---

## 📚 Additional Resources

### Learning Materials
- [Prophet Documentation](https://facebook.github.io/prophet/)
- [TensorFlow Time Series Tutorial](https://www.tensorflow.org/tutorials/structured_data/time_series)
- [AWS Time Series Forecasting Guide](https://docs.aws.amazon.com/forecast/latest/dg/what-is-forecast.html)

### Research Papers
- "Temporal Fusion Transformers for Interpretable Multi-horizon Time Series Forecasting" (2021)
- "DeepAR: Probabilistic Forecasting with Autoregressive Recurrent Networks" (Amazon, 2019)
- "N-BEATS: Neural basis expansion analysis for interpretable time series forecasting" (2020)

### Tools & Libraries
- **Prophet:** facebook.github.io/prophet
- **ONNX Runtime:** onnxruntime.ai
- **MLflow:** mlflow.org
- **TensorFlow.js:** tensorflow.org/js

---

## 🔄 Future Enhancements

### Phase 6+: Advanced Features

1. **Multi-Meter Correlation Analysis**
   - Train models considering relationships between meters
   - Example: "HVAC increase → Lighting decrease"

2. **Reinforcement Learning for Optimization**
   - Learn optimal load shifting strategies
   - Maximize savings while maintaining comfort/production

3. **Transfer Learning**
   - Pre-train model on similar buildings
   - Fine-tune for new installations (faster deployment)

4. **Natural Language Insights**
   - GPT integration for explaining predictions
   - Example: "High consumption predicted due to hot weather and increased occupancy"

5. **Federated Learning** (Multi-Site)
   - Train global model across multiple buildings
   - Preserve privacy (data never leaves premises)

---

## 📞 Support & Next Steps

**For Implementation:**
1. Review this document with technical team
2. Complete feature engineering (Phase 1)
3. Set up Python ML environment
4. Start with Prophet POC (2 weeks)
5. Measure accuracy improvements
6. Plan full LSTM deployment

**Questions or Clarifications:**
- Contact ML team or data science consultant
- Schedule technical review session
- Request POC demonstration

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Implementation  
**Estimated Timeline:** 8-12 weeks full deployment

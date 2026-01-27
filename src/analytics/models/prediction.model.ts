import { Injectable, Logger } from '@nestjs/common';
// import * as tf from '@tensorflow/tfjs-node';
import * as math from 'mathjs';
import moment from 'moment';

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
}

export interface PredictionConfig {
  modelType: 'linear' | 'exponential' | 'arima' | 'neural';
  lookbackPeriods: number;
  forecastHorizon: number;
  confidenceLevel: number;
}

export interface ModelMetrics {
  mae: number; // Mean Absolute Error
  mse: number; // Mean Squared Error
  rmse: number; // Root Mean Squared Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
}

@Injectable()
export class PredictionModel {
  private readonly logger = new Logger(PredictionModel.name);
  // private models: Map<string, tf.LayersModel> = new Map(); // COMMENTED OUT: TensorFlow not installed

  /**
   * Predict future values using linear regression
   */
  async predictLinear(
    historicalData: TimeSeriesData[],
    forecastPeriods: number,
  ): Promise<{ predictions: number[]; confidenceIntervals: Array<{ low: number; high: number }> }> {
    if (historicalData.length < 2) {
      throw new Error('Insufficient historical data for prediction');
    }

    // Convert dates to numeric values (days since first date)
    const startDate = historicalData[0].timestamp;
    const x = historicalData.map((d, i) => i);
    const y = historicalData.map(d => d.value);

    // Calculate linear regression coefficients
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate predictions
    const predictions: number[] = [];
    for (let i = n; i < n + forecastPeriods; i++) {
      predictions.push(intercept + slope * i);
    }

    // Calculate confidence intervals
    const residuals = y.map((yi, i) => yi - (intercept + slope * x[i]));
    const residualStd = Math.sqrt(
      residuals.reduce((a, b) => a + b * b, 0) / (n - 2),
    );

    const confidenceIntervals = predictions.map((pred, i) => {
      const xNew = n + i;
      const se = residualStd * Math.sqrt(1 + 1 / n + (xNew - sumX / n) ** 2 / (sumX2 - sumX ** 2 / n));
      const tValue = 1.96; // For 95% confidence interval

      return {
        low: pred - tValue * se,
        high: pred + tValue * se,
      };
    });

    return { predictions, confidenceIntervals };
  }

  /**
   * Predict using exponential smoothing (Holt-Winters)
   */
  async predictExponentialSmoothing(
    historicalData: TimeSeriesData[],
    forecastPeriods: number,
    alpha: number = 0.3,
    beta: number = 0.1,
    gamma: number = 0.1,
    seasonality: number = 12,
  ): Promise<number[]> {
    const values = historicalData.map(d => d.value);
    const n = values.length;

    if (n < seasonality * 2) {
      this.logger.warn('Insufficient data for seasonality detection');
      return this.predictSimpleExponentialSmoothing(values, forecastPeriods, alpha);
    }

    // Holt-Winters triple exponential smoothing
    const level = Array(n).fill(0);
    const trend = Array(n).fill(0);
    const seasonal = Array(n).fill(0);
    const forecast = Array(n + forecastPeriods).fill(0);

    // Initialize seasonal indices
    for (let i = 0; i < seasonality; i++) {
      seasonal[i] = values[i] / math.mean(values.slice(0, seasonality));
    }

    // Initialize level and trend
    level[0] = values[0];
    trend[0] = (values[seasonality] - values[0]) / seasonality;

    // Calculate level, trend, and seasonal components
    for (let i = 1; i < n; i++) {
      if (i >= seasonality) {
        seasonal[i] = gamma * (values[i] / level[i - 1]) + (1 - gamma) * seasonal[i - seasonality];
      }
      level[i] = alpha * (values[i] / seasonal[i]) + (1 - alpha) * (level[i - 1] + trend[i - 1]);
      trend[i] = beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1];
    }

    // Generate forecasts
    for (let i = n; i < n + forecastPeriods; i++) {
      const seasonIndex = (i - seasonality) % seasonality;
      forecast[i] = (level[n - 1] + (i - n + 1) * trend[n - 1]) * seasonal[seasonIndex + seasonality];
    }

    return forecast.slice(n);
  }

  /**
   * Simple exponential smoothing
   */
  private predictSimpleExponentialSmoothing(
    values: number[],
    forecastPeriods: number,
    alpha: number,
  ): number[] {
    const smoothed = [...values];
    for (let i = 1; i < values.length; i++) {
      smoothed[i] = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
    }

    const lastSmoothed = smoothed[smoothed.length - 1];
    return Array(forecastPeriods).fill(lastSmoothed);
  }

  /**
   * Train neural network model for time series prediction
   * COMMENTED OUT: TensorFlow not installed
   */
  /*
  async trainNeuralModel(
    historicalData: TimeSeriesData[],
    modelName: string,
    config: PredictionConfig = {
      modelType: 'neural',
      lookbackPeriods: 7,
      forecastHorizon: 3,
      confidenceLevel: 0.95,
    },
  ): Promise<ModelMetrics> {
    try {
      const values = historicalData.map(d => d.value);
      
      // Prepare training data
      const { xs, ys } = this.prepareTimeSeriesData(values, config.lookbackPeriods, config.forecastHorizon);

      // Create model
      const model = tf.sequential();

      // Input layer
      model.add(tf.layers.lstm({
        units: 50,
        returnSequences: true,
        inputShape: [config.lookbackPeriods, 1],
      }));

      // Hidden layers
      model.add(tf.layers.dropout({ rate: 0.2 }));
      model.add(tf.layers.lstm({ units: 50, returnSequences: false }));
      model.add(tf.layers.dropout({ rate: 0.2 }));

      // Output layer
      model.add(tf.layers.dense({ units: config.forecastHorizon }));

      // Compile model
      model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae'],
      });

      // Train model
      const history = await model.fit(xs, ys, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        verbose: 0,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 20 === 0) {
              this.logger.debug(`Epoch ${epoch}: loss = ${logs?.loss}, val_loss = ${logs?.val_loss}`);
            }
          },
        },
      });

      // Store model
      this.models.set(modelName, model);

      // Calculate metrics
      const predictions = model.predict(xs) as tf.Tensor;
      const predValues = await predictions.data();
      const actualValues = await ys.data();

      const metrics = this.calculateMetrics(Array.from(actualValues), Array.from(predValues));
      
      this.logger.log(`Neural model trained: ${modelName}, R2 = ${metrics.r2.toFixed(3)}`);
      
      return metrics;
    } catch (error) {
      this.logger.error(`Failed to train neural model: ${error.message}`);
      throw error;
    }
  }
  */

  /**
   * Prepare time series data for neural network training
   * COMMENTED OUT: TensorFlow not installed
   */
  /*
  private prepareTimeSeriesData(
    values: number[],
    lookback: number,
    forecastHorizon: number,
  ): { xs: tf.Tensor; ys: tf.Tensor } {
    const xs: number[][][] = [];
    const ys: number[][] = [];

    for (let i = lookback; i < values.length - forecastHorizon; i++) {
      const x = values.slice(i - lookback, i);
      const y = values.slice(i, i + forecastHorizon);
      
      xs.push(x.map(v => [v]));
      ys.push(y);
    }

    return {
      xs: tf.tensor3d(xs),
      ys: tf.tensor2d(ys),
    };
  }
  */

  /**
   * Calculate prediction metrics
   */
  private calculateMetrics(actual: number[], predicted: number[]): ModelMetrics {
    const n = actual.length;
    let sumAbsError = 0;
    let sumSquaredError = 0;
    let sumAbsPercentageError = 0;

    for (let i = 0; i < n; i++) {
      const error = actual[i] - predicted[i];
      sumAbsError += Math.abs(error);
      sumSquaredError += error * error;
      sumAbsPercentageError += Math.abs(error / actual[i]);
    }

    const mae = sumAbsError / n;
    const mse = sumSquaredError / n;
    const rmse = Math.sqrt(mse);
    const mape = (sumAbsPercentageError / n) * 100;

    // Calculate R-squared
    const meanActual = actual.reduce((a, b) => a + b, 0) / n;
    let totalSumSquares = 0;
    for (let i = 0; i < n; i++) {
      totalSumSquares += (actual[i] - meanActual) ** 2;
    }
    const r2 = 1 - sumSquaredError / totalSumSquares;

    return { mae, mse, rmse, mape, r2 };
  }

  /**
   * Predict using trained neural model
   * COMMENTED OUT: TensorFlow not installed
   */
  /*
  async predictWithNeuralModel(
    modelName: string,
    historicalData: TimeSeriesData[],
    forecastPeriods: number,
  ): Promise<{ predictions: number[]; confidence: number }> {
    const model = this.models.get(modelName);
    
    if (!model) {
      throw new Error(`Model ${modelName} not found`);
    }

    const values = historicalData.map(d => d.value);
    const lookback = model.input.shape[1] as number;
    
    if (values.length < lookback) {
      throw new Error(`Need at least ${lookback} historical data points`);
    }

    // Prepare input
    const input = values.slice(-lookback).map(v => [v]);
    const inputTensor = tf.tensor3d([input]);

    // Make prediction
    const predictionTensor = model.predict(inputTensor) as tf.Tensor;
    const predictions = Array.from(await predictionTensor.data());

    // Calculate confidence based on model metrics
    const confidence = 0.85; // This would come from model validation metrics

    return {
      predictions: predictions.slice(0, forecastPeriods),
      confidence,
    };
  }
  */

  /**
   * Detect anomalies in time series data
   */
  detectAnomalies(
    data: TimeSeriesData[],
    windowSize: number = 7,
    threshold: number = 3,
  ): Array<{ timestamp: Date; value: number; anomalyScore: number }> {
    const values = data.map(d => d.value);
    const anomalies: Array<{ timestamp: Date; value: number; anomalyScore: number }> = [];

    for (let i = windowSize; i < values.length; i++) {
      const window = values.slice(i - windowSize, i);
      const mean = math.mean(window);
      const std = math.std(window) as unknown as number;

      const zScore = Math.abs((values[i] - mean) / std);
      
      if (zScore > threshold) {
        anomalies.push({
          timestamp: data[i].timestamp,
          value: values[i],
          anomalyScore: zScore,
        });
      }
    }

    return anomalies;
  }

  /**
   * Calculate trend direction and strength
   */
  calculateTrend(
    data: TimeSeriesData[],
    method: 'linear' | 'mann_kendall' = 'linear',
  ): { direction: 'increasing' | 'decreasing' | 'stable'; strength: number; slope: number } {
    const values = data.map(d => d.value);
    
    if (method === 'linear') {
      // Linear regression trend
      const n = values.length;
      const x = Array.from({ length: n }, (_, i) => i);
      
      const sumX = x.reduce((a, b) => a + b, 0);
      const sumY = values.reduce((a, b) => a + b, 0);
      const sumXY = x.reduce((a, b, i) => a + b * values[i], 0);
      const sumX2 = x.reduce((a, b) => a + b * b, 0);

      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      
      // Calculate R-squared for strength
      const yMean = sumY / n;
      let ssTotal = 0;
      let ssResidual = 0;
      
      for (let i = 0; i < n; i++) {
        const yPred = values[0] + slope * i;
        ssTotal += (values[i] - yMean) ** 2;
        ssResidual += (values[i] - yPred) ** 2;
      }
      
      const r2 = 1 - ssResidual / ssTotal;
      const strength = Math.abs(slope) * r2;

      return {
        direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
        strength,
        slope,
      };
    } else {
      // Mann-Kendall trend test
      let s = 0;
      const n = values.length;
      
      for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
          s += Math.sign(values[j] - values[i]);
        }
      }

      // Calculate variance
      const variance = (n * (n - 1) * (2 * n + 5)) / 18;
      const z = s / Math.sqrt(variance);

      return {
        direction: z > 1.96 ? 'increasing' : z < -1.96 ? 'decreasing' : 'stable',
        strength: Math.abs(z),
        slope: z,
      };
    }
  }

  /**
   * Clean up TensorFlow models
   * COMMENTED OUT: TensorFlow not installed
   */
  /*
  async cleanup(): Promise<void> {
    for (const [name, model] of this.models) {
      model.dispose();
      this.models.delete(name);
    }
    this.logger.log('Cleaned up all neural models');
  }
  */
}
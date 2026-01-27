import { Injectable } from '@nestjs/common';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface FacilityReportData {
  facilityName: string;
  county: string;
  subCounty: string;
  period: string;
  generatedAt: Date;
  totalImmunizations: number;
  coverageRate: number;
  timelinessRate: number;
  dropoutRate: number;
  performanceScore: number;
  ranking?: number;
  totalRanked?: number;
  monthlyTrends: Array<{
    month: string;
    immunizations: number;
    coverage: number;
  }>;
  vaccineBreakdown: Array<{
    vaccineName: string;
    count: number;
    percentage: number;
  }>;
  growthRate: number;
  recommendations: string[];
}

@Injectable()
export class FacilityReportTemplate {
  constructor() {
    // No template loading needed, using generateHTML directly
  }

  generate(data: FacilityReportData): string {
    return this.generateHTML(data);
  }

  generateHTML(data: FacilityReportData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.facilityName} Performance Report</title>
        <style>
          body { 
            font-family: 'Arial', sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5;
          }
          .report-container { 
            max-width: 210mm; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            box-shadow: 0 0 20px rgba(0,0,0,0.1); 
            border-radius: 5px;
          }
          .header { 
            text-align: center; 
            border-bottom: 2px solid #2196F3; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
          }
          .facility-title { 
            color: #1976D2; 
            margin: 10px 0; 
            font-size: 28px;
          }
          .facility-subtitle { 
            color: #666; 
            font-size: 18px; 
            margin-bottom: 10px;
          }
          .performance-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin: 30px 0;
          }
          .metric-card { 
            background: #f9f9f9; 
            padding: 20px; 
            border-radius: 5px; 
            text-align: center; 
            border-top: 4px solid #2196F3;
          }
          .metric-value { 
            font-size: 36px; 
            font-weight: bold; 
            margin: 10px 0;
          }
          .metric-label { 
            color: #666; 
            font-size: 14px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
          }
          .ranking-badge { 
            display: inline-block; 
            background: #FFC107; 
            color: #333; 
            padding: 5px 15px; 
            border-radius: 20px; 
            font-weight: bold; 
            margin-left: 10px;
          }
          .chart-container { 
            margin: 30px 0; 
            padding: 20px; 
            background: #f9f9f9; 
            border-radius: 5px;
          }
          .data-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
          }
          .data-table th { 
            background: #2196F3; 
            color: white; 
            padding: 12px; 
            text-align: left;
          }
          .data-table td { 
            padding: 10px 12px; 
            border-bottom: 1px solid #ddd;
          }
          .data-table tr:hover { 
            background: #f5f5f5;
          }
          .recommendations { 
            background: #E3F2FD; 
            padding: 20px; 
            border-radius: 5px; 
            margin: 20px 0; 
            border-left: 4px solid #2196F3;
          }
          .recommendations h3 { 
            color: #1565C0; 
            margin-top: 0;
          }
          .footer { 
            text-align: center; 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #ddd; 
            color: #666; 
            font-size: 12px;
          }
          .trend-up { color: #4CAF50; }
          .trend-down { color: #F44336; }
          .trend-neutral { color: #607D8B; }
          @media print {
            body { background: white; }
            .report-container { box-shadow: none; padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="report-container">
          <!-- Header -->
          <div class="header">
            <h1 class="facility-title">${data.facilityName}</h1>
            <div class="facility-subtitle">${data.county} County, ${data.subCounty} Sub-County</div>
            <div>Performance Report for ${data.period}</div>
            ${data.ranking ? `
              <div style="margin-top: 10px;">
                <strong>Ranking:</strong> 
                <span class="ranking-badge">#${data.ranking} of ${data.totalRanked} facilities</span>
              </div>
            ` : ''}
            <div>Generated on: ${new Date(data.generatedAt).toLocaleDateString('en-KE')}</div>
          </div>

          <!-- Performance Metrics -->
          <div class="performance-grid">
            <div class="metric-card" style="border-top-color: #4CAF50;">
              <div class="metric-value">${data.coverageRate.toFixed(1)}%</div>
              <div class="metric-label">Coverage Rate</div>
            </div>
            <div class="metric-card" style="border-top-color: #FF9800;">
              <div class="metric-value">${data.timelinessRate.toFixed(1)}%</div>
              <div class="metric-label">Timeliness Rate</div>
            </div>
            <div class="metric-card" style="border-top-color: #F44336;">
              <div class="metric-value">${data.dropoutRate.toFixed(1)}%</div>
              <div class="metric-label">Dropout Rate</div>
            </div>
            <div class="metric-card" style="border-top-color: #2196F3;">
              <div class="metric-value">${data.performanceScore.toFixed(0)}</div>
              <div class="metric-label">Performance Score</div>
              <div style="margin-top: 5px; font-size: 14px; color: ${data.performanceScore >= 90 ? '#4CAF50' : data.performanceScore >= 80 ? '#8BC34A' : data.performanceScore >= 70 ? '#FFC107' : data.performanceScore >= 60 ? '#FF9800' : '#F44336'}">
                ${data.performanceScore >= 90 ? 'Excellent' : data.performanceScore >= 80 ? 'Good' : data.performanceScore >= 70 ? 'Fair' : data.performanceScore >= 60 ? 'Needs Improvement' : 'Poor'}
              </div>
            </div>
          </div>

          <!-- Growth Indicator -->
          <div style="text-align: center; margin: 20px 0; padding: 15px; background: #E8F5E9; border-radius: 5px;">
            <h3 style="color: #2E7D32; margin: 0 0 10px 0;">
              Growth Rate: ${data.growthRate > 0 ? '+' : ''}${data.growthRate.toFixed(1)}%
              <span style="margin-left: 10px; color: ${data.growthRate > 10 ? '#4CAF50' : data.growthRate > 0 ? '#8BC34A' : data.growthRate > -10 ? '#FFC107' : '#F44336'}">
                ${data.growthRate > 0 ? '▲' : data.growthRate < 0 ? '▼' : '➡'}
              </span>
            </h3>
            <div style="color: #666;">
              Compared to previous period
            </div>
          </div>

          <!-- Monthly Trends -->
          <h2 style="color: #1976D2; border-bottom: 2px solid #2196F3; padding-bottom: 10px;">
            Monthly Trends
          </h2>
          <div class="chart-container">
            <canvas id="trendChart" width="800" height="300"></canvas>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Immunizations</th>
                <th>Coverage Rate</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              ${data.monthlyTrends.map((trend, index) => {
                const prevTrend = index > 0 ? data.monthlyTrends[index - 1] : null;
                const trendIcon = prevTrend ? 
                  (trend.immunizations > prevTrend.immunizations ? '▲' : 
                   trend.immunizations < prevTrend.immunizations ? '▼' : '➡') : '➡';
                const trendColor = prevTrend ?
                  (trend.immunizations > prevTrend.immunizations ? '#4CAF50' :
                   trend.immunizations < prevTrend.immunizations ? '#F44336' : '#607D8B') : '#607D8B';
                
                return `
                  <tr>
                    <td>${trend.month}</td>
                    <td>${trend.immunizations.toLocaleString()}</td>
                    <td>${trend.coverage.toFixed(1)}%</td>
                    <td style="color: ${trendColor}; font-weight: bold;">
                      ${trendIcon}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <!-- Vaccine Breakdown -->
          <h2 style="color: #1976D2; border-bottom: 2px solid #2196F3; padding-bottom: 10px; margin-top: 30px;">
            Vaccine Administration Breakdown
          </h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>Vaccine</th>
                <th>Count</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              ${data.vaccineBreakdown.map(vaccine => `
                <tr>
                  <td>${vaccine.vaccineName}</td>
                  <td>${vaccine.count.toLocaleString()}</td>
                  <td>${vaccine.percentage.toFixed(1)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Total Immunizations -->
          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #FFF3E0; border-radius: 5px;">
            <h2 style="color: #E65100; margin: 0 0 10px 0;">
              Total Immunizations: ${data.totalImmunizations.toLocaleString()}
            </h2>
            <div style="color: #666; font-size: 16px;">
              Over the reporting period
            </div>
          </div>

          <!-- Recommendations -->
          <div class="recommendations">
            <h3>Recommendations for Improvement</h3>
            <ul style="margin: 10px 0; padding-left: 20px;">
              ${data.recommendations.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
            </ul>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div>ImmuniTrack Kenya - Ministry of Health</div>
            <div>Facility Performance Report - ${data.facilityName}</div>
            <div>Report generated on: ${new Date(data.generatedAt).toLocaleString('en-KE')}</div>
            <div class="no-print">
              <button onclick="window.print()" style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                Print Report
              </button>
            </div>
          </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            const ctx = document.getElementById('trendChart').getContext('2d');
            const months = ${JSON.stringify(data.monthlyTrends.map(t => t.month))};
            const immunizations = ${JSON.stringify(data.monthlyTrends.map(t => t.immunizations))};
            const coverage = ${JSON.stringify(data.monthlyTrends.map(t => t.coverage))};

            new Chart(ctx, {
              type: 'line',
              data: {
                labels: months,
                datasets: [
                  {
                    label: 'Immunizations',
                    data: immunizations,
                    borderColor: '#2196F3',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    yAxisID: 'y'
                  },
                  {
                    label: 'Coverage Rate (%)',
                    data: coverage,
                    borderColor: '#4CAF50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    yAxisID: 'y1'
                  }
                ]
              },
              options: {
                responsive: true,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                scales: {
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                      display: true,
                      text: 'Immunizations'
                    }
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                      display: true,
                      text: 'Coverage Rate (%)'
                    },
                    grid: {
                      drawOnChartArea: false,
                    },
                    min: 0,
                    max: 100
                  }
                },
                plugins: {
                  title: {
                    display: true,
                    text: 'Monthly Performance Trends'
                  }
                }
              }
            });
          });
        </script>
      </body>
      </html>
    `;
  }
}
import { Injectable } from '@nestjs/common';
import * as handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

export interface CoverageReportData {
  title: string;
  period: string;
  generatedAt: Date;
  overallCoverage: number;
  targetCoverage: number;
  coverageGap: number;
  totalChildren: number;
  vaccinatedChildren: number;
  byCounty: Array<{
    county: string;
    coverage: number;
    children: number;
    vaccinated: number;
  }>;
  byFacility?: Array<{
    facilityName: string;
    coverage: number;
    children: number;
    vaccinated: number;
  }>;
  trends?: {
    previousPeriodCoverage: number;
    percentageChange: number;
    direction: 'improving' | 'declining' | 'stable';
  };
  recommendations?: string[];
}

@Injectable()
export class CoverageReportTemplate {
  constructor() {
    // No template loading needed, using generateHTML directly
  }

  generate(data: CoverageReportData): string {
    return this.generateHTML(data);
  }

  generateHTML(data: CoverageReportData): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${data.title}</title>
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
            border-bottom: 2px solid #4CAF50; 
            padding-bottom: 20px; 
            margin-bottom: 30px;
          }
          .ministry-logo { 
            height: 80px; 
            margin-bottom: 10px;
          }
          .report-title { 
            color: #2E7D32; 
            margin: 10px 0; 
            font-size: 28px;
          }
          .report-period { 
            color: #666; 
            font-size: 18px; 
            margin-bottom: 10px;
          }
          .summary-card { 
            background: #E8F5E9; 
            padding: 20px; 
            border-radius: 5px; 
            margin: 20px 0; 
            display: flex; 
            justify-content: space-around; 
            text-align: center;
          }
          .summary-item { 
            flex: 1; 
            padding: 0 10px;
          }
          .summary-value { 
            font-size: 32px; 
            font-weight: bold; 
            color: #2E7D32; 
            margin: 10px 0;
          }
          .summary-label { 
            color: #666; 
            font-size: 14px;
          }
          .coverage-gauge { 
            width: 200px; 
            height: 200px; 
            margin: 20px auto; 
            position: relative;
          }
          .gauge-background { 
            fill: none; 
            stroke: #e0e0e0; 
            stroke-width: 10;
          }
          .gauge-fill { 
            fill: none; 
            stroke: #4CAF50; 
            stroke-width: 10; 
            stroke-linecap: round; 
            transform: rotate(-90deg); 
            transform-origin: 50% 50%;
          }
          .gauge-text { 
            text-anchor: middle; 
            font-size: 24px; 
            font-weight: bold; 
            fill: #333;
          }
          .gauge-label { 
            text-anchor: middle; 
            font-size: 14px; 
            fill: #666;
          }
          .data-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin: 20px 0;
          }
          .data-table th { 
            background: #4CAF50; 
            color: white; 
            padding: 12px; 
            text-align: left;
          }
          .data-table td { 
            padding: 10px 12px; 
            border-bottom: 1px solid #ddd;
          }
          .data-table tr:hover { 
            background: #f9f9f9;
          }
          .coverage-cell { 
            font-weight: bold;
          }
          .recommendations { 
            background: #FFF3E0; 
            padding: 20px; 
            border-radius: 5px; 
            margin: 20px 0; 
            border-left: 4px solid #FF9800;
          }
          .recommendations h3 { 
            color: #E65100; 
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
          .trend-indicator { 
            display: inline-block; 
            margin-left: 10px; 
            font-weight: bold;
          }
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
            <img src="{{ministryLogo}}" alt="Ministry of Health Logo" class="ministry-logo">
            <h1 class="report-title">${data.title}</h1>
            <div class="report-period">${data.period}</div>
            <div>Generated on: ${new Date(data.generatedAt).toLocaleDateString('en-KE')}</div>
          </div>

          <!-- Summary Cards -->
          <div class="summary-card">
            <div class="summary-item">
              <div class="summary-value">${data.overallCoverage.toFixed(1)}%</div>
              <div class="summary-label">Overall Coverage</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${data.totalChildren.toLocaleString()}</div>
              <div class="summary-label">Total Children</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${data.vaccinatedChildren.toLocaleString()}</div>
              <div class="summary-label">Vaccinated</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${data.coverageGap.toFixed(1)}%</div>
              <div class="summary-label">Coverage Gap</div>
            </div>
          </div>

          <!-- Trends -->
          ${data.trends ? `
            <div style="text-align: center; margin: 20px 0; padding: 15px; background: #E3F2FD; border-radius: 5px;">
              <h3 style="color: #1565C0; margin: 0 0 10px 0;">
                Trend: ${data.trends.direction === 'improving' ? 'Improving' : data.trends.direction === 'declining' ? 'Declining' : 'Stable'}
                <span class="trend-indicator" style="color: ${data.trends.direction === 'improving' ? '#4CAF50' : data.trends.direction === 'declining' ? '#F44336' : '#607D8B'}">
                  ${data.trends.direction === 'improving' ? '▲' : data.trends.direction === 'declining' ? '▼' : '➡'}
                </span>
              </h3>
              <div style="font-size: 18px; color: #333;">
                ${Math.abs(data.trends.percentageChange).toFixed(1)}% ${data.trends.direction === 'improving' ? 'increase' : data.trends.direction === 'declining' ? 'decrease' : 'change'} from previous period
              </div>
              <div style="color: #666; margin-top: 5px;">
                Previous period coverage: ${data.trends.previousPeriodCoverage.toFixed(1)}%
              </div>
            </div>
          ` : ''}

          <!-- County Breakdown -->
          <h2 style="color: #2E7D32; border-bottom: 2px solid #4CAF50; padding-bottom: 10px;">
            Coverage by County
          </h2>
          <table class="data-table">
            <thead>
              <tr>
                <th>County</th>
                <th>Children</th>
                <th>Vaccinated</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              ${data.byCounty.map(county => `
                <tr>
                  <td>${county.county}</td>
                  <td>${county.children.toLocaleString()}</td>
                  <td>${county.vaccinated.toLocaleString()}</td>
                  <td class="coverage-cell" style="color: ${county.coverage >= 90 ? '#4CAF50' : county.coverage >= 80 ? '#FFC107' : county.coverage >= 70 ? '#FF9800' : '#F44336'}">
                    ${county.coverage.toFixed(1)}%
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Facility Breakdown (if available) -->
          ${data.byFacility && data.byFacility.length > 0 ? `
            <h2 style="color: #2E7D32; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; margin-top: 30px;">
              Coverage by Facility (Top 10)
            </h2>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Facility</th>
                  <th>Children</th>
                  <th>Vaccinated</th>
                  <th>Coverage</th>
                </tr>
              </thead>
              <tbody>
                ${data.byFacility.slice(0, 10).map(facility => `
                  <tr>
                    <td>${facility.facilityName}</td>
                    <td>${facility.children.toLocaleString()}</td>
                    <td>${facility.vaccinated.toLocaleString()}</td>
                    <td class="coverage-cell" style="color: ${facility.coverage >= 90 ? '#4CAF50' : facility.coverage >= 80 ? '#FFC107' : facility.coverage >= 70 ? '#FF9800' : '#F44336'}">
                      ${facility.coverage.toFixed(1)}%
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          <!-- Recommendations -->
          ${data.recommendations && data.recommendations.length > 0 ? `
            <div class="recommendations">
              <h3>Recommendations</h3>
              <ul style="margin: 10px 0; padding-left: 20px;">
                ${data.recommendations.map(rec => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <div>ImmuniTrack Kenya - Ministry of Health</div>
            <div>Report generated on: ${new Date(data.generatedAt).toLocaleString('en-KE')}</div>
            <div>This is an official report. For inquiries, contact: analytics@immunitrack.co.ke</div>
            <div class="no-print">
              <button onclick="window.print()" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-top: 10px;">
                Print Report
              </button>
            </div>
          </div>
        </div>

        <script>
          // Gauge animation
          document.addEventListener('DOMContentLoaded', function() {
            const gauge = document.querySelector('.gauge-fill');
            if (gauge) {
              const coverage = ${data.overallCoverage};
              const circumference = 2 * Math.PI * 90; // radius 90
              const offset = circumference - (coverage / 100) * circumference;
              gauge.style.strokeDasharray = \`\${circumference} \${circumference}\`;
              gauge.style.strokeDashoffset = offset;
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}
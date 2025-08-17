// Add Excel-like table styles  
export const excelTableStyles = `
  /* Hide spinner buttons for number inputs */
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  input[type="number"] {
    -moz-appearance: textfield;
  }
  
  .project-info-table {
    table-layout: auto;
    width: 100%;
  }
  
  .project-info-table td {
    white-space: nowrap;
    padding: 2px 4px !important;
    border-color: #000000 !important;
  }
  
  .project-info-table input,
  .project-info-table select {
    min-width: 100px;
  }
  
  /* Color coding for project info table - using only specified colors */
  .project-info-table .linked-data {
    background-color: #FFC0CB !important; /* Pink for linked data/sources */
  }
  .project-info-table .linked-data input,
  .project-info-table .linked-data select {
    background-color: #FFC0CB !important;
  }
  
  .project-info-table .final-output {
    background-color: #90EE90 !important; /* Green for final output */
  }
  .project-info-table .final-output input {
    background-color: #90EE90 !important;
  }
  
  .project-info-table input[type="number"] {
    text-align: center !important;
  }
  
  @media (max-width: 768px) {
    .project-info-table {
      min-width: 800px;
    }
  }
  
  .excel-table {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    min-width: 1400px;
    table-layout: fixed;
  }
  
  .excel-table th,
  .excel-table td {
    border: 1px solid #000000;
    padding: 0 !important;
    margin: 0 !important;
    overflow: hidden;
  }
  
  /* Column widths - wider for better usability */
  .excel-table th:nth-child(1), .excel-table td:nth-child(1) { width: 180px; }  /* Description */
  .excel-table th:nth-child(2), .excel-table td:nth-child(2) { width: 65px; }   /* From - wider */
  .excel-table th:nth-child(3), .excel-table td:nth-child(3) { width: 65px; }   /* To - wider */
  .excel-table th:nth-child(4), .excel-table td:nth-child(4) { width: 70px; }   /* Thickness - wider */
  .excel-table th:nth-child(5), .excel-table td:nth-child(5) { width: 70px; }   /* Type - wider */
  .excel-table th:nth-child(6), .excel-table td:nth-child(6) { width: 70px; }   /* Depth (m) - wider */
  .excel-table th:nth-child(7), .excel-table td:nth-child(7) { width: 80px; }   /* Run Length - wider */
  .excel-table th:nth-child(8), .excel-table td:nth-child(8) { width: 80px; }   /* 15 cm 1 - increased width to match sample columns */
  .excel-table th:nth-child(9), .excel-table td:nth-child(9) { width: 80px; }   /* 15 cm 2 - increased width to match sample columns */
  .excel-table th:nth-child(10), .excel-table td:nth-child(10) { width: 80px; } /* 15 cm 3 - increased width to match sample columns */
  .excel-table th:nth-child(11), .excel-table td:nth-child(11) { width: 65px; } /* N-Value - wider */
  .excel-table th:nth-child(12), .excel-table td:nth-child(12) { width: 75px; } /* Core Length - wider */
  .excel-table th:nth-child(13), .excel-table td:nth-child(13) { width: 60px; } /* TCR (%) - wider */
  .excel-table th:nth-child(14), .excel-table td:nth-child(14) { width: 75px; } /* RQD Length - wider */
  .excel-table th:nth-child(15), .excel-table td:nth-child(15) { width: 60px; } /* RQD (%) - wider */
  .excel-table th:nth-child(16), .excel-table td:nth-child(16) { width: 75px; } /* Water Color - wider */
  .excel-table th:nth-child(17), .excel-table td:nth-child(17) { width: 75px; } /* Water Loss - wider */
  .excel-table th:nth-child(18), .excel-table td:nth-child(18) { width: 75px; } /* Hole Diameter - wider */
  .excel-table th:nth-child(19), .excel-table td:nth-child(19) { width: 100px; } /* Remarks - wider */
  .excel-table th:nth-child(20), .excel-table td:nth-child(20) { width: 70px; } /* Actions - wider */
  
  .excel-table input,
  .excel-table textarea {
    margin: 0 !important;
    padding: 2px 3px !important;
    border: none !important;
    border-radius: 0 !important;
    width: 100% !important;
    height: 100% !important;
    min-height: 40px !important;
    font-size: 11px !important;
    line-height: 1.2 !important;
    box-shadow: none !important;
    display: block !important;
    color: #000000 !important; /* Black text */
  }
  
  /* Placeholder styling */
  .excel-table input::placeholder,
  .excel-table textarea::placeholder {
    color: #6B7280 !important; /* Darker grey placeholders for better visibility */
    opacity: 1 !important;
  }
  
  /* Specific placeholder styling for grey fields */
  .excel-table .numeric-input input::placeholder {
    color: #374151 !important; /* Even darker grey for numeric input fields */
    opacity: 1 !important;
  }
  
  .excel-table input:focus,
  .excel-table textarea:focus {
    outline: 2px solid #3b82f6 !important;
    outline-offset: -2px !important;
    box-shadow: none !important;
  }
  
  .excel-table textarea {
    resize: none !important;
    min-height: 40px !important;
    vertical-align: top !important;
    font-size: 11px !important;
    line-height: 1.2 !important;
  }
  
  .excel-table input[type="number"] {
    text-align: center !important;
    direction: ltr !important;
  }
  
  .excel-table input[type="number"]:focus {
    direction: ltr !important;
    text-align: center !important;
  }
  
  .excel-table input.text-left,
  .excel-table textarea.text-left {
    text-align: left !important;
    direction: ltr !important;
  }
  
  /* Color coding based on legend */
  
  /* 🟨 Yellow - Manual Text */
  .excel-table .manual-text {
    background-color: #FFEB00 !important; /* Yellow for manual input */
  }
  .excel-table .manual-text input,
  .excel-table .manual-text textarea {
    background-color: #FFEB00 !important;
  }
  
  /* 🟦 Grey - Numeric Input */
  .excel-table .numeric-input {
    background-color: #ADADAC !important; /* Grey for numeric input */
  }
  .excel-table .numeric-input input {
    background-color: #ADADAC !important;
  }
  
  /* 🟫 Brown - Calculated */
  .excel-table .calculated {
    background-color: #B55110 !important; /* Brown for calculated */
  }
  .excel-table .calculated input {
    background-color: #B55110 !important;
  }
  
  /* 🟩 Pink - Linked Data/Sources */
  .excel-table .linked-data {
    background-color: #FFC0CB !important; /* Pink for linked data/sources */
  }
  .excel-table .linked-data input,
  .excel-table .linked-data select {
    background-color: #FFC0CB !important;
  }
  
  /* 🟩 Green - Final Output */
  .excel-table .final-output {
    background-color: #90EE90 !important; /* Green for final output */
  }
  .excel-table .final-output input {
    background-color: #90EE90 !important;
  }
  
  /* 🔴 Red - Hatch/Attachment */
  .excel-table .hatch-attachment {
    background-color: #FF6B6B !important; /* Red for hatch/attachment */
  }
  .excel-table .hatch-attachment input {
    background-color: #FF6B6B !important;
  }
  
  /* 🟧 Light Peach - From other source */
  .excel-table .other-source {
    background-color:rgb(250, 212, 218) !important; /* Light peach for other source */
  }
  .excel-table .other-source input {
    background-color:rgb(243, 215, 219) !important;
  }
  
  /* Project Info Table Color Styles */
  .project-info-table .manual-text {
    background-color: #FFEB00 !important; /* Yellow for manual input */
  }
  .project-info-table .manual-text input,
  .project-info-table .manual-text select {
    background-color: #FFEB00 !important;
  }

  .project-info-table .numeric-input {
    background-color: #ADADAC !important; /* Grey for numeric input */
  }
  .project-info-table .numeric-input input {
    background-color: #ADADAC !important;
  }

  .project-info-table .calculated {
    background-color: #B55110 !important; /* Brown for calculated */
  }
  .project-info-table .calculated input {
    background-color: #B55110 !important;
  }

  .project-info-table .linked-data {
    background-color:rgb(249, 209, 216) !important; /* Pink for linked data/sources */
  }
  .project-info-table .linked-data input,
  .project-info-table .linked-data select {
    background-color:rgb(251, 210, 217) !important;
  }

  .project-info-table .final-output {
    background-color: #90EE90 !important; /* Green for final output */
  }
  .project-info-table .final-output input {
    background-color: #90EE90 !important;
  }

  .project-info-table .hatch-attachment {
    background-color: #FF6B6B !important; /* Red for hatch/attachment */
  }
  .project-info-table .hatch-attachment input {
    background-color: #FF6B6B !important;
  }

  .project-info-table .other-source {
    background-color: #FFB6C1 !important; /* Light peach for other source */
  }
  .project-info-table .other-source input {
    background-color: #FFB6C1 !important;
  }
  
  /* Specific field alignments to match screenshot exactly */
  .excel-table td:nth-child(1) input,
  .excel-table td:nth-child(1) textarea { text-align: left !important; direction: ltr !important; } /* Description - left aligned */
  .excel-table td:nth-child(5) input { text-align: left !important; direction: ltr !important; } /* Type - left aligned (D-1) */
  .excel-table td:nth-child(16) input { text-align: left !important; direction: ltr !important; } /* Water Color - left aligned */
  .excel-table td:nth-child(17) input { text-align: left !important; direction: ltr !important; } /* Water Loss - left aligned */
  .excel-table td:nth-child(18) input { text-align: left !important; direction: ltr !important; } /* Hole Diameter - left aligned */
  .excel-table td:nth-child(19) textarea { text-align: left !important; direction: ltr !important; } /* Remarks - left aligned */
  
  /* Parent row styling with thicker borders to differentiate strata */
  .excel-table tr.parent-row {
    border-bottom: 1px solid #000000 !important; /* Normal border for parent rows */
  }
  .excel-table tr.parent-row td {
    font-weight: 600 !important;
    border-bottom: 1px solid #000000 !important; /* Normal border for parent row cells */
  }
  
  /* Last row of each stratum (parent + subdivisions) gets normal border */
  .excel-table tr.last-row-of-stratum {
    border-bottom: 1px solid #000000 !important; /* Normal border between different strata */
  }
  .excel-table tr.last-row-of-stratum td {
    border-bottom: 1px solid #000000 !important; /* Normal border for all cells in last row of stratum */
  }
  
  /* Make table headers black and bold */
  .excel-table th {
    background-color: #f3f4f6 !important;
    color: #000000 !important;
    font-weight: 700 !important;
  }
  .excel-table tr.parent-row.collapsed + tr.subdivision {
    display: none !important;
  }
  
  /* Subdivision styling - keep normal borders */
  .excel-table tr.subdivision {
    height: 40px !important; /* Consistent height with parent rows */
    border-bottom: 1px solid #000000 !important; /* Normal border for subdivisions */
  }
  .excel-table tr.subdivision td {
    border-bottom: 1px solid #000000 !important; /* Normal border for subdivision cells */
  }
  
  /* Spanned cells in parent row */
  .excel-table tr.parent-row td[rowspan] {
    vertical-align: top !important;
    position: relative !important;
    border-bottom: 1px solid #000000 !important; /* Normal border for spanned cells */
    height: auto !important;
    min-height: 40px !important;
    background-color: inherit !important;
  }
  /* Spanned cells in last row of stratum get normal border */
  .excel-table tr.last-row-of-stratum td[rowspan] {
    border-bottom: 1px solid #000000 !important; /* Normal border for spanned cells in last row of stratum */
  }
  .excel-table tr.parent-row td[rowspan] textarea,
  .excel-table tr.parent-row td[rowspan] input {
    height: 100% !important;
    min-height: 40px !important;
    resize: none !important;
    overflow-y: auto !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    white-space: pre-wrap !important;
    word-wrap: break-word !important;
    line-height: 1.2 !important;
    font-size: 11px !important;
  }
  

  

  
  /* Shared cells in parent row */
  .excel-table tr.subdivision td:empty {
    border-top: none !important;
  }
  
  /* Ensure spanned cells don't create visual gaps */
  .excel-table tr.parent-row td[rowspan] + tr.subdivision {
    border-left: none !important;
  }
  
  /* Hide borders between spanned cells */
  .excel-table tr.subdivision:not(:first-child) {
    border-top: none !important;
  }
  /* Collapse/Expand icon */
  .excel-table tr.parent-row .collapse-icon {
    cursor: pointer;
    transition: transform 0.2s;
  }
  .excel-table tr.parent-row.collapsed .collapse-icon {
    transform: rotate(-90deg);
  }
`;

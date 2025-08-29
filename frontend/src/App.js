import React, { useState, useEffect } from 'react';
import { Paper, TextField, Button, Typography, Box } from '@mui/material';
import mermaid from 'mermaid';
import axios from 'axios';

function App() {
  const [sqlInput, setSqlInput] = useState('');
  const [dmnOutput, setDmnOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [diagramSvg, setDiagramSvg] = useState('');

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose'
    });
  }, []);

  const generateDiagramFromXML = async (dmnXml) => {
    try {
      // Parse the XML to extract decision table information
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(dmnXml, "text/xml");
      
      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        throw new Error('Invalid XML document');
      }
      
      // Extract decision and rules information
      const decision = xmlDoc.querySelector("decision");
      const decisionTable = xmlDoc.querySelector("decisionTable");
      const inputs = xmlDoc.querySelectorAll("input");
      const rules = xmlDoc.querySelectorAll("rule");

      if (!decision || !decisionTable) {
        throw new Error('Invalid DMN XML structure: missing decision or decision table');
      }
      
      // Create a mermaid diagram definition with subgraph
      let diagramDefinition = 'graph TD\n';
      diagramDefinition += '  subgraph DMN["SQL to DMN Decision"]\n';
      
      // Add decision node
      const decisionName = decision.getAttribute("name") || 'Decision';
      diagramDefinition += `    Decision[["${decisionName}"]]\n`;
      
      // Add input nodes in a subgraph
      diagramDefinition += '    subgraph Inputs\n';
      inputs.forEach((input, idx) => {
        const inputLabel = input.getAttribute("label") || 
                         input.querySelector("inputExpression text")?.textContent ||
                         `Input ${idx + 1}`;
        diagramDefinition += `      Input${idx}["${inputLabel}"]\n`;
        diagramDefinition += `      Input${idx} --> Decision\n`;
      });
      diagramDefinition += '    end\n';
      
      // Add rules in a subgraph
      diagramDefinition += '    subgraph Rules\n';
      rules.forEach((rule, idx) => {
        const inputEntry = rule.querySelector("inputEntry text");
        if (inputEntry) {
          const condition = inputEntry.textContent
            .replace(/"/g, "'")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          diagramDefinition += `      Rule${idx}["${condition}"]\n`;
          diagramDefinition += `      Rule${idx} --> Decision\n`;
        }
      });
      diagramDefinition += '    end\n';
      diagramDefinition += '  end\n';

      console.log('Diagram Definition:', diagramDefinition); // Debug log
      
      // Generate a clean ID (only letters and numbers)
      const diagramId = 'dmn-diagram-' + Math.floor(Math.random() * 10000);
      
      // Clear any existing diagrams with the same ID
      const existingDiagram = document.getElementById(diagramId);
      if (existingDiagram) {
        existingDiagram.remove();
      }
      
      console.log('Rendering diagram with ID:', diagramId);
      const { svg } = await mermaid.render(diagramId, diagramDefinition);
      return svg;
    } catch (error) {
      console.error('Error generating diagram:', error);
      return '';
    }
  };

  const handleConvert = async () => {
    if (!sqlInput.trim()) {
      setError('Please enter SQL query');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/convert', { sql: sqlInput });
      if (response.data.success) {
        setDmnOutput(JSON.stringify(response.data.dmn, null, 2));
        if (response.data.diagram) {
          const id = `mermaid-${Date.now()}`;
          const { svg } = await mermaid.render(id, response.data.diagram);
          setDiagramSvg(svg);
        }
      } else {
        setError(response.data.error || 'Conversion failed');
      }
    } catch (err) {
      setError('Error: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, margin: 'auto', p: 3 }}>
      <Typography variant="h4" gutterBottom align="center">
        SQL to DMN Converter
      </Typography>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={4}
          label="Enter SQL Query"
          value={sqlInput}
          onChange={(e) => setSqlInput(e.target.value)}
          error={!!error}
          helperText={error}
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          onClick={handleConvert}
          disabled={isLoading}
          fullWidth
        >
          {isLoading ? 'Converting...' : 'Convert to DMN'}
        </Button>
      </Paper>

      {dmnOutput && (
        <>
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>DMN Output:</Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={dmnOutput}
              InputProps={{ readOnly: true }}
            />
          </Paper>

          {diagramSvg && (
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Diagram:</Typography>
              <Box sx={{ 
                width: '100%', 
                textAlign: 'center',
                '& svg': { maxWidth: '100%', height: 'auto' }
              }}>
                <div dangerouslySetInnerHTML={{ __html: diagramSvg }} />
              </Box>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
}

export default App;

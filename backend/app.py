from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from xml.etree import ElementTree as ET

app = Flask(__name__)
CORS(app)

def generate_diagram_from_dmn(dmn_xml):
    try:
        from xml.etree import ElementTree as ET
        
        # Parse the XML string
        root = ET.fromstring(dmn_xml)
        
        # Find the decision and its components
        namespaces = {'dmn': 'https://www.omg.org/spec/DMN/20191111/MODEL/'}
        decision = root.find('.//dmn:decision', namespaces)
        inputs = root.findall('.//dmn:input', namespaces)
        rules = root.findall('.//dmn:rule', namespaces)
        
        # Create simple mermaid diagram
        diagram = ['graph TD']
        diagram.append('    Decision["SQL Decision"]')
        
        # Add inputs
        for idx, input_elem in enumerate(inputs):
            text = input_elem.find('.//dmn:text', namespaces)
            name = text.text if text is not None else f'Input {idx + 1}'
            diagram.append(f'    Input{idx}["{name}"] --> Decision')
        
        # Add rules
        for idx, rule in enumerate(rules):
            entry = rule.find('.//dmn:inputEntry/dmn:text', namespaces)
            if entry is not None:
                condition = entry.text.replace('"', "'").replace('<', '&lt;').replace('>', '&gt;')
                diagram.append(f'    Rule{idx}["{condition}"] --> Decision')
        
        return {"success": True, "diagram": '\n'.join(diagram)}
    except Exception as e:
        return {"success": False, "error": str(e)}

def generate_dmn_xml(sql_query, input_data, rules):
    # Generate a unique ID for the decision
    decision_id = f"decision_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    # Build input definitions based on extracted data
    input_definitions = ""
    for i, inp in enumerate(input_data):
        input_definitions += f'''
            <input id="input_{i+1}" label="{inp['name']}">
                <inputExpression typeRef="{inp['type']}">
                    <text>{inp['name']}</text>
                </inputExpression>
            </input>'''
    
    # Build rule definitions
    rule_definitions = ""
    for i, rule in enumerate(rules):
        rule_definitions += f'''
            <rule id="{decision_id}_rule_{i+1}">
                <inputEntry>
                    <text>{rule['condition']}</text>
                </inputEntry>
                <outputEntry>
                    <text>{rule['output']}</text>
                </outputEntry>
            </rule>'''
    
    # Start building the DMN XML with more detailed structure
    dmn_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="{decision_id}"
             name="SQL to DMN Conversion"
             namespace="http://camunda.org/schema/1.0/dmn">
    
    <decision id="{decision_id}_decision" name="SQL Conditions">
        <decisionTable id="{decision_id}_decisionTable" hitPolicy="UNIQUE">
            {input_definitions}
            
            <output id="output_1" label="Result" name="result" typeRef="boolean" />
            
            {rule_definitions}
        </decisionTable>
    </decision>
    
    <dmndi:DMNDI>
        <dmndi:DMNDiagram id="{decision_id}_diagram">
            <dmndi:DMNShape id="shape_1" dmnElementRef="{decision_id}_decision">
                <dc:Bounds height="80" width="180" x="100" y="100" />
            </dmndi:DMNShape>
        </dmndi:DMNDiagram>
    </dmndi:DMNDI>
</definitions>'''
    
    return dmn_xml

@app.route('/api/convert', methods=['POST'])
def convert_sql_to_dmn():
    try:
        sql_query = request.json.get('sql')
        if not sql_query:
            return jsonify({"success": False, "error": "No SQL query provided"}), 400

        sql_lower = sql_query.lower()
        input_data = []
        rules = []

        if "where" in sql_lower:
            where_part = sql_lower.split("where")[1].strip()
            conditions = where_part.split("and")
            
            for cond in conditions:
                parts = cond.strip().split()
                if len(parts) >= 3:
                    input_data.append({
                        "name": parts[0],
                        "type": "string"
                    })
                    rules.append({
                        "condition": cond.strip(),
                        "output": "true"
                    })

        # Generate DMN XML
        dmn_xml = generate_dmn_xml(sql_query, input_data, rules)

        dmn_output = {
            "decision": {
                "name": "SQL Decision",
                "input": input_data,
                "rules": rules,
                "original_sql": sql_query,
                "dmn_xml": dmn_xml
            }
        }
        
        # Generate diagram using OpenAI
        diagram_result = generate_diagram_from_dmn(dmn_xml)
        
        return jsonify({
            "success": True,
            "dmn": dmn_output,
            "diagram": diagram_result.get("diagram") if diagram_result["success"] else None,
            "diagram_error": diagram_result.get("error") if not diagram_result["success"] else None
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

"""
SafeguardsIQ — Factories Act Form 18 PDF Generator
Generates official accident register as per Factories Act 1948, Section 88 & Rule 121
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph,
                                 Spacer, HRFlowable, KeepTogether)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import io, json
from datetime import datetime

# ── COLORS ──
ORANGE   = colors.HexColor("#FF5B18")
DARK     = colors.HexColor("#0F1A2E")
NAVY     = colors.HexColor("#1E3A5F")
WHITE    = colors.white
LGRAY    = colors.HexColor("#F5F7FA")
MGRAY    = colors.HexColor("#D0D7E3")
RED      = colors.HexColor("#C0392B")
GREEN    = colors.HexColor("#1B5E20")
AMBER    = colors.HexColor("#E65100")

W, H = A4

def make_styles():
    base = getSampleStyleSheet()
    styles = {}
    styles["title"] = ParagraphStyle("title",
        fontName="Helvetica-Bold", fontSize=16,
        textColor=WHITE, alignment=TA_CENTER,
        spaceAfter=4, leading=20)
    styles["subtitle"] = ParagraphStyle("subtitle",
        fontName="Helvetica", fontSize=10,
        textColor=LGRAY, alignment=TA_CENTER, spaceAfter=2)
    styles["act_ref"] = ParagraphStyle("act_ref",
        fontName="Helvetica-Oblique", fontSize=8,
        textColor=MGRAY, alignment=TA_CENTER, spaceAfter=2)
    styles["section"] = ParagraphStyle("section",
        fontName="Helvetica-Bold", fontSize=10,
        textColor=WHITE, alignment=TA_LEFT, spaceAfter=2)
    styles["field_label"] = ParagraphStyle("field_label",
        fontName="Helvetica-Bold", fontSize=8,
        textColor=NAVY, alignment=TA_LEFT)
    styles["field_value"] = ParagraphStyle("field_value",
        fontName="Helvetica", fontSize=9,
        textColor=DARK, alignment=TA_LEFT)
    styles["footer"] = ParagraphStyle("footer",
        fontName="Helvetica", fontSize=7,
        textColor=colors.HexColor("#888888"), alignment=TA_CENTER)
    styles["warning"] = ParagraphStyle("warning",
        fontName="Helvetica-Bold", fontSize=9,
        textColor=RED, alignment=TA_LEFT)
    styles["normal"] = ParagraphStyle("normal",
        fontName="Helvetica", fontSize=9,
        textColor=DARK, alignment=TA_LEFT)
    return styles

def section_header(title, styles):
    data = [[Paragraph(f"  {title}", styles["section"])]]
    t = Table(data, colWidths=[170*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ]))
    return t

def field_row(label, value, styles, bg=None):
    data = [[
        Paragraph(label, styles["field_label"]),
        Paragraph(str(value) if value else "—", styles["field_value"]),
    ]]
    t = Table(data, colWidths=[65*mm, 105*mm])
    ts = [
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
        ("LINEBELOW",     (0,0), (-1,-1), 0.5, MGRAY),
    ]
    if bg:
        ts.append(("BACKGROUND", (0,0), (-1,-1), bg))
    t.setStyle(TableStyle(ts))
    return t

def two_field_row(l1, v1, l2, v2, styles, bg=None):
    data = [[
        Paragraph(l1, styles["field_label"]),
        Paragraph(str(v1) if v1 else "—", styles["field_value"]),
        Paragraph(l2, styles["field_label"]),
        Paragraph(str(v2) if v2 else "—", styles["field_value"]),
    ]]
    t = Table(data, colWidths=[45*mm, 40*mm, 45*mm, 40*mm])
    ts = [
        ("VALIGN",        (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("RIGHTPADDING",  (0,0), (-1,-1), 6),
        ("LINEBELOW",     (0,0), (-1,-1), 0.5, MGRAY),
        ("LINEAFTER",     (1,0), (1,0), 0.5, MGRAY),
    ]
    if bg:
        ts.append(("BACKGROUND", (0,0), (-1,-1), bg))
    t.setStyle(TableStyle(ts))
    return t

def generate_form18(data: dict) -> bytes:
    """
    Generate Form 18 PDF.
    data keys:
      factory_name, factory_address, registration_no, industry_type
      accident_date, accident_time, accident_location, shift
      injured_name, age, sex, designation, department, employment_type
      nature_of_injury, body_part, severity (fatal/serious/minor)
      cause_of_accident, machine_involved, activity_at_time
      ppe_violations (list), ai_confidence, camera_id
      first_aid_given, hospital_name, doctor_name
      immediate_action_taken, corrective_action, preventive_action
      reported_by, manager_name, manager_designation
      report_date, report_no
      violations_evidence (list of dicts with timestamp, type, confidence)
    """
    buf    = io.BytesIO()
    doc    = SimpleDocTemplate(buf, pagesize=A4,
                                leftMargin=15*mm, rightMargin=15*mm,
                                topMargin=15*mm, bottomMargin=20*mm)
    styles = make_styles()
    story  = []

    # ── HEADER ──
    header_data = [[
        Paragraph("FORM 18", styles["title"]),
        Paragraph("SafeguardsIQ", ParagraphStyle("brand",
            fontName="Helvetica-Bold", fontSize=11,
            textColor=ORANGE, alignment=TA_RIGHT)),
    ]]
    header_t = Table(header_data, colWidths=[130*mm, 40*mm])
    header_t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), DARK),
        ("TOPPADDING",    (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(header_t)

    sub_data = [[
        Paragraph("ACCIDENT / DANGEROUS OCCURRENCE REGISTER", styles["subtitle"]),
        Paragraph(f"Report No: {data.get('report_no','AUTO-'+datetime.now().strftime('%Y%m%d%H%M'))}", styles["subtitle"]),
    ]]
    sub_t = Table(sub_data, colWidths=[120*mm, 50*mm])
    sub_t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), NAVY),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 10),
        ("RIGHTPADDING",  (0,0), (-1,-1), 10),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
    ]))
    story.append(sub_t)

    act_data = [[Paragraph(
        "As required under Section 88 &amp; 88A of the Factories Act, 1948 | Rule 121 of Factory Rules | "
        "To be submitted to Inspector of Factories within 24 hours of fatal / 48 hours of serious accident",
        styles["act_ref"])]]
    act_t = Table(act_data, colWidths=[170*mm])
    act_t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), colors.HexColor("#0A1020")),
        ("TOPPADDING",    (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ]))
    story.append(act_t)
    story.append(Spacer(1, 4*mm))

    # ── AI DETECTION ALERT (if violations present) ──
    violations = data.get("ppe_violations", [])
    if violations:
        sev = data.get("severity","").lower()
        alert_color = RED if sev == "fatal" else AMBER if sev == "serious" else colors.HexColor("#1565C0")
        viol_text = ", ".join(violations) if violations else "PPE Violation"
        alert_data = [[
            Paragraph("⚠  AI DETECTION ALERT", ParagraphStyle("al",
                fontName="Helvetica-Bold", fontSize=9, textColor=WHITE)),
            Paragraph(
                f"SafeguardsIQ AI detected: <b>{viol_text}</b> | "
                f"Confidence: {data.get('ai_confidence','—')}% | "
                f"Camera: {data.get('camera_id','—')} | "
                f"Detected at: {data.get('accident_time','—')}",
                ParagraphStyle("av", fontName="Helvetica", fontSize=8, textColor=LGRAY)),
        ]]
        alert_t = Table(alert_data, colWidths=[45*mm, 125*mm])
        alert_t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0), (-1,-1), alert_color),
            ("TOPPADDING",    (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ("LEFTPADDING",   (0,0), (-1,-1), 8),
            ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ]))
        story.append(alert_t)
        story.append(Spacer(1, 3*mm))

    # ── SECTION 1: FACTORY DETAILS ──
    story.append(section_header("1. FACTORY DETAILS", styles))
    story.append(field_row("Factory / Company Name", data.get("factory_name"), styles, LGRAY))
    story.append(field_row("Factory Address", data.get("factory_address"), styles))
    story.append(two_field_row(
        "Registration No.", data.get("registration_no"),
        "Type of Industry", data.get("industry_type"),
        styles, LGRAY))
    story.append(two_field_row(
        "Total Workers", data.get("total_workers"),
        "Shift System", data.get("shift_system","3-shift"),
        styles))
    story.append(Spacer(1, 3*mm))

    # ── SECTION 2: ACCIDENT DETAILS ──
    story.append(section_header("2. ACCIDENT / OCCURRENCE DETAILS", styles))
    story.append(two_field_row(
        "Date of Accident", data.get("accident_date"),
        "Time of Accident", data.get("accident_time"),
        styles, LGRAY))
    story.append(two_field_row(
        "Location / Zone", data.get("accident_location"),
        "Shift", data.get("shift"),
        styles))
    story.append(field_row("Nature / Description of Accident",
        data.get("nature_of_injury"), styles, LGRAY))
    story.append(field_row("Machine / Equipment Involved",
        data.get("machine_involved","Not applicable"), styles))
    story.append(field_row("Activity at Time of Accident",
        data.get("activity_at_time"), styles, LGRAY))
    story.append(field_row("Cause of Accident",
        data.get("cause_of_accident"), styles))

    # Severity badge
    sev = data.get("severity","minor").upper()
    sev_color = RED if sev=="FATAL" else AMBER if sev=="SERIOUS" else colors.HexColor("#1565C0")
    sev_data = [[
        Paragraph("Severity Classification:", styles["field_label"]),
        Paragraph(f"  {sev}  ", ParagraphStyle("sev",
            fontName="Helvetica-Bold", fontSize=10, textColor=WHITE,
            alignment=TA_CENTER)),
        Paragraph("(FATAL requires reporting within 24 hrs / SERIOUS within 48 hrs)",
            styles["field_label"]),
    ]]
    sev_t = Table(sev_data, colWidths=[50*mm, 28*mm, 92*mm])
    sev_t.setStyle(TableStyle([
        ("BACKGROUND",    (1,0), (1,0), sev_color),
        ("BACKGROUND",    (0,0), (0,0), LGRAY),
        ("BACKGROUND",    (2,0), (2,0), LGRAY),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("LINEBELOW",     (0,0), (-1,-1), 0.5, MGRAY),
    ]))
    story.append(sev_t)
    story.append(Spacer(1, 3*mm))

    # ── SECTION 3: INJURED PERSON ──
    story.append(section_header("3. DETAILS OF INJURED / DECEASED PERSON", styles))
    story.append(field_row("Full Name", data.get("injured_name"), styles, LGRAY))
    story.append(two_field_row(
        "Age", data.get("age"),
        "Sex", data.get("sex","Male"),
        styles))
    story.append(two_field_row(
        "Designation", data.get("designation"),
        "Department", data.get("department"),
        styles, LGRAY))
    story.append(two_field_row(
        "Employment Type", data.get("employment_type","Permanent"),
        "Years of Experience", data.get("experience_years"),
        styles))
    story.append(two_field_row(
        "Body Part Injured", data.get("body_part"),
        "PPE Worn at Time", data.get("ppe_worn_at_time","Not confirmed"),
        styles, LGRAY))
    story.append(Spacer(1, 3*mm))

    # ── SECTION 4: PPE VIOLATIONS (AI DETECTED) ──
    story.append(section_header("4. PPE VIOLATIONS DETECTED BY AI (SafeguardsIQ)", styles))

    evidence = data.get("violations_evidence", [])
    if evidence:
        ev_headers = [["#","Timestamp","PPE Violation","Confidence","Camera","Severity"]]
        ev_rows = []
        for i, ev in enumerate(evidence[:10]):
            ev_rows.append([
                str(i+1),
                ev.get("timestamp","—"),
                ev.get("type","—"),
                f"{ev.get('confidence','—')}%",
                ev.get("camera_id","—"),
                ev.get("severity","high").upper(),
            ])
        ev_data = ev_headers + ev_rows
        ev_t = Table(ev_data, colWidths=[8*mm, 35*mm, 45*mm, 22*mm, 35*mm, 25*mm])
        ev_ts = [
            ("BACKGROUND",    (0,0), (-1,0), NAVY),
            ("TEXTCOLOR",     (0,0), (-1,0), WHITE),
            ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE",      (0,0), (-1,-1), 8),
            ("TOPPADDING",    (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING",   (0,0), (-1,-1), 4),
            ("GRID",          (0,0), (-1,-1), 0.5, MGRAY),
            ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ]
        for i, row in enumerate(ev_rows):
            if i % 2 == 0:
                ev_ts.append(("BACKGROUND", (0,i+1), (-1,i+1), LGRAY))
            sev_val = row[5]
            if "FATAL" in sev_val or "CRITICAL" in sev_val:
                ev_ts.append(("TEXTCOLOR", (5,i+1), (5,i+1), RED))
                ev_ts.append(("FONTNAME",  (5,i+1), (5,i+1), "Helvetica-Bold"))
        ev_t.setStyle(TableStyle(ev_ts))
        story.append(ev_t)
    else:
        story.append(field_row("PPE Violations Detected",
            ", ".join(violations) if violations else "None recorded", styles, LGRAY))
        story.append(field_row("AI Confidence",
            f"{data.get('ai_confidence','—')}%", styles))
        story.append(field_row("Camera ID",
            data.get("camera_id","—"), styles, LGRAY))

    story.append(Spacer(1, 3*mm))

    # ── SECTION 5: MEDICAL ──
    story.append(section_header("5. MEDICAL TREATMENT", styles))
    story.append(field_row("First Aid Given", data.get("first_aid_given","Yes"), styles, LGRAY))
    story.append(field_row("Hospital / Medical Centre", data.get("hospital_name"), styles))
    story.append(two_field_row(
        "Doctor Name", data.get("doctor_name"),
        "Date of Treatment", data.get("treatment_date", data.get("accident_date")),
        styles, LGRAY))
    story.append(field_row("Estimated Days Lost / Disability",
        data.get("days_lost","Under assessment"), styles))
    story.append(Spacer(1, 3*mm))

    # ── SECTION 6: ACTIONS ──
    story.append(section_header("6. CORRECTIVE & PREVENTIVE ACTIONS", styles))
    story.append(field_row("Immediate Action Taken",
        data.get("immediate_action_taken"), styles, LGRAY))
    story.append(field_row("Corrective Action (Short-term)",
        data.get("corrective_action"), styles))
    story.append(field_row("Preventive Action (Long-term)",
        data.get("preventive_action"), styles, LGRAY))
    story.append(field_row("Target Completion Date",
        data.get("action_target_date"), styles))
    story.append(Spacer(1, 3*mm))

    # ── SECTION 7: REPORTING ──
    story.append(section_header("7. REPORTING DETAILS", styles))
    story.append(two_field_row(
        "Report Generated On", data.get("report_date", datetime.now().strftime("%d/%m/%Y %H:%M")),
        "Reported By", data.get("reported_by","SafeguardsIQ AI System"),
        styles, LGRAY))
    story.append(two_field_row(
        "Manager / EHS Officer", data.get("manager_name"),
        "Designation", data.get("manager_designation","EHS Manager"),
        styles))
    story.append(field_row("Inspector of Factories — Jurisdiction",
        data.get("inspector_jurisdiction"), styles, LGRAY))
    story.append(field_row("Date Submitted to Inspector",
        data.get("submission_date","Pending"), styles))
    story.append(Spacer(1, 5*mm))

    # ── SIGNATURES ──
    sig_data = [[
        Paragraph("_______________________\nSignature of Manager\n" + (data.get("manager_name","") or ""),
            ParagraphStyle("sig", fontName="Helvetica", fontSize=8, textColor=DARK, alignment=TA_CENTER)),
        Paragraph("_______________________\nSignature of EHS Officer\n" + (data.get("ehs_officer","") or ""),
            ParagraphStyle("sig", fontName="Helvetica", fontSize=8, textColor=DARK, alignment=TA_CENTER)),
        Paragraph("_______________________\nOccupier / Director\n" + (data.get("occupier_name","") or ""),
            ParagraphStyle("sig", fontName="Helvetica", fontSize=8, textColor=DARK, alignment=TA_CENTER)),
    ]]
    sig_t = Table(sig_data, colWidths=[56*mm, 57*mm, 57*mm])
    sig_t.setStyle(TableStyle([
        ("TOPPADDING",    (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
        ("LEFTPADDING",   (0,0), (-1,-1), 6),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("VALIGN",        (0,0), (-1,-1), "BOTTOM"),
        ("BOX",           (0,0), (-1,-1), 0.5, MGRAY),
        ("LINEAFTER",     (0,0), (1,0), 0.5, MGRAY),
    ]))
    story.append(sig_t)
    story.append(Spacer(1, 4*mm))

    # ── FOOTER ──
    footer_data = [[
        Paragraph(
            "Generated by <b>SafeguardsIQ AI</b> by Syyaim Enterprises | safeguardsiq.com | "
            "This report is auto-generated from AI detection data. Verify all fields before submission to Inspector of Factories. | "
            f"Generated: {datetime.now().strftime('%d %b %Y %H:%M IST')}",
            styles["footer"]),
    ]]
    footer_t = Table(footer_data, colWidths=[170*mm])
    footer_t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,-1), DARK),
        ("TOPPADDING",    (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
    ]))
    story.append(footer_t)

    doc.build(story)
    buf.seek(0)
    return buf.read()


# ── TEST WITH SAMPLE DATA ──
if __name__ == "__main__":
    sample = {
        "factory_name":       "Pune Auto Components Pvt Ltd",
        "factory_address":    "Plot 45, MIDC Industrial Area, Pimpri, Pune - 411018, Maharashtra",
        "registration_no":    "MH/PUN/2019/00234",
        "industry_type":      "Auto Components Manufacturing",
        "total_workers":      120,
        "shift_system":       "3-shift (General, Morning, Night)",
        "accident_date":      "07/04/2026",
        "accident_time":      "14:23 IST",
        "accident_location":  "Assembly Line A — Zone 2",
        "shift":              "General Shift (08:00–17:00)",
        "nature_of_injury":   "Worker sustained hand injury while operating press machine without safety gloves",
        "machine_involved":   "Hydraulic Press Machine — HP-45",
        "activity_at_time":   "Loading metal components into press",
        "cause_of_accident":  "PPE non-compliance — safety gloves not worn. AI system detected violation 28 seconds before incident.",
        "severity":           "serious",
        "injured_name":       "Rajesh Kumar Sharma",
        "age":                34,
        "sex":                "Male",
        "designation":        "Machine Operator",
        "department":         "Assembly Line A",
        "employment_type":    "Permanent",
        "experience_years":   6,
        "body_part":          "Right hand — fingers",
        "ppe_worn_at_time":   "No gloves detected by AI at 14:23:02",
        "ppe_violations":     ["Gloves","Helmet"],
        "ai_confidence":      94,
        "camera_id":          "cam-assembly-a-02",
        "violations_evidence": [
            {"timestamp":"07/04/2026 14:22:58","type":"No Gloves","confidence":94,"camera_id":"cam-assembly-a-02","severity":"high"},
            {"timestamp":"07/04/2026 14:23:02","type":"No Helmet","confidence":87,"camera_id":"cam-assembly-a-02","severity":"high"},
            {"timestamp":"07/04/2026 14:22:43","type":"No Gloves","confidence":91,"camera_id":"cam-assembly-a-02","severity":"high"},
        ],
        "first_aid_given":      "Yes — First aid provided by safety officer on site",
        "hospital_name":        "Ruby Hall Clinic, Pune",
        "doctor_name":          "Dr. Amit Desai",
        "treatment_date":       "07/04/2026",
        "days_lost":            "Estimated 7–10 days",
        "immediate_action_taken": "1. Machine stopped immediately\n2. First aid administered\n3. Worker transported to hospital\n4. Area cordoned off",
        "corrective_action":    "1. Mandatory PPE check before machine operation\n2. Supervisor verification protocol introduced\n3. SafeguardsIQ alerts escalated to plant manager",
        "preventive_action":    "1. PPE dispensers installed at all entry points\n2. Daily AI-monitored PPE compliance audit\n3. Monthly safety training reinforced",
        "action_target_date":   "21/04/2026",
        "reported_by":          "SafeguardsIQ AI System + Suresh Nair (Plant Manager)",
        "manager_name":         "Suresh Nair",
        "manager_designation":  "Plant Manager",
        "inspector_jurisdiction": "Inspector of Factories, Pune Division",
        "submission_date":      "07/04/2026 — Within 48 hours as per Act",
        "report_date":          datetime.now().strftime("%d/%m/%Y %H:%M"),
        "report_no":            "FORM18-2026-0407-001",
    }

    pdf_bytes = generate_form18(sample)
    with open("/mnt/user-data/outputs/Form18_Sample.pdf", "wb") as f:
        f.write(pdf_bytes)
    print(f"PDF generated: {len(pdf_bytes)//1024}KB")

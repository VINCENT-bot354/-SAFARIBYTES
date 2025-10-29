import os
from datetime import datetime
import pytz
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO

def get_nairobi_time():
    return datetime.now(pytz.timezone('Africa/Nairobi'))

class PDFService:
    def __init__(self, storage_bucket='./backups'):
        self.storage_bucket = storage_bucket
        os.makedirs(storage_bucket, exist_ok=True)
    
    def generate_terms_pdf(self, content, version):
        """Generate PDF for Terms & Conditions"""
        timestamp = get_nairobi_time().strftime('%Y%m%d_%H%M%S')
        filename = f"terms_v{version}_{timestamp}.pdf"
        filepath = os.path.join(self.storage_bucket, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        story.append(Paragraph("Terms & Conditions", title_style))
        story.append(Paragraph(f"Version {version}", styles['Normal']))
        story.append(Paragraph(f"Generated: {get_nairobi_time().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        for line in content.split('\n'):
            if line.strip():
                story.append(Paragraph(line, styles['Normal']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        return filepath
    
    def generate_business_report(self, data):
        """Generate comprehensive business report PDF"""
        timestamp = get_nairobi_time().strftime('%Y%m%d_%H%M%S')
        filename = f"business_report_{timestamp}.pdf"
        filepath = os.path.join(self.storage_bucket, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'ReportTitle',
            parent=styles['Heading1'],
            fontSize=28,
            textColor=colors.HexColor('#1a1a1a'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        )
        
        heading_style = ParagraphStyle(
            'ReportHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#333333'),
            spaceAfter=15,
            spaceBefore=20
        )
        
        story.append(Paragraph("SAFARI BYTES 🍔", title_style))
        story.append(Paragraph("Business Report", styles['Heading2']))
        story.append(Paragraph(f"Generated: {get_nairobi_time().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 30))
        
        story.append(Paragraph("Table of Contents", heading_style))
        toc_data = [
            ["1.", "Executive Summary"],
            ["2.", "Cash Flow Analysis"],
            ["3.", "Sales Analysis"],
            ["4.", "Employee Performance"],
            ["5.", "Summary"]
        ]
        toc_table = Table(toc_data, colWidths=[0.5*inch, 5*inch])
        toc_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(toc_table)
        story.append(PageBreak())
        
        story.append(Paragraph("1. Executive Summary", heading_style))
        summary_data = [
            ["Metric", "Value (KES)"],
            ["Total Revenue", f"{data.get('total_revenue', 0):,.2f}"],
            ["Total Capital", f"{data.get('total_capital', 0):,.2f}"],
            ["Total Profit", f"{data.get('total_profit', 0):,.2f}"],
            ["Total Orders", str(data.get('total_orders', 0))],
            ["Product Sales", f"{data.get('product_sales', 0):,.2f}"],
            ["Delivery Fees", f"{data.get('delivery_fees', 0):,.2f}"]
        ]
        summary_table = Table(summary_data, colWidths=[3*inch, 2*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(summary_table)
        story.append(PageBreak())
        
        story.append(Paragraph("2. Cash Flow Analysis", heading_style))
        story.append(Paragraph(f"Total Capital Invested: KES {data.get('total_capital', 0):,.2f}", styles['Normal']))
        story.append(Paragraph(f"Total Revenue Generated: KES {data.get('total_revenue', 0):,.2f}", styles['Normal']))
        story.append(Paragraph(f"Net Profit: KES {data.get('total_profit', 0):,.2f}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        if data.get('capital_entries'):
            capital_data = [["Date", "Purpose", "Amount (KES)"]]
            for entry in data['capital_entries'][:10]:
                capital_data.append([
                    entry['date'],
                    entry['purpose'][:50],
                    f"{entry['amount']:,.2f}"
                ])
            capital_table = Table(capital_data, colWidths=[1.5*inch, 3*inch, 1.5*inch])
            capital_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(capital_table)
        
        story.append(PageBreak())
        
        story.append(Paragraph("3. Sales Analysis", heading_style))
        if data.get('top_products'):
            products_data = [["Product", "Units Sold", "Revenue (KES)"]]
            for product in data['top_products'][:10]:
                products_data.append([
                    product['name'][:30],
                    str(product['units_sold']),
                    f"{product['revenue']:,.2f}"
                ])
            products_table = Table(products_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
            products_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(products_table)
        
        story.append(PageBreak())
        
        story.append(Paragraph("4. Employee Performance", heading_style))
        if data.get('staff_performance'):
            staff_data = [["Staff Member", "Deliveries", "Revenue (KES)"]]
            for staff in data['staff_performance']:
                staff_data.append([
                    staff['name'],
                    str(staff['deliveries']),
                    f"{staff['revenue']:,.2f}"
                ])
            staff_table = Table(staff_data, colWidths=[2.5*inch, 1.5*inch, 2*inch])
            staff_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(staff_table)
        
        story.append(PageBreak())
        
        story.append(Paragraph("5. Summary & Recommendations", heading_style))
        story.append(Paragraph("This report provides a comprehensive overview of business operations.", styles['Normal']))
        story.append(Paragraph(f"Report Period: {data.get('period', 'All Time')}", styles['Normal']))
        story.append(Spacer(1, 30))
        story.append(Paragraph("End of Report", title_style))
        
        doc.build(story)
        return filepath
    
    def generate_backup_pdf(self, data):
        """Generate backup PDF with all database data"""
        timestamp = get_nairobi_time().strftime('%Y%m%d_%H%M%S')
        filename = f"backup_{timestamp}.pdf"
        filepath = os.path.join(self.storage_bucket, filename)
        
        doc = SimpleDocTemplate(filepath, pagesize=A4)
        story = []
        styles = getSampleStyleSheet()
        
        story.append(Paragraph("SAFARI BYTES Database Backup", styles['Title']))
        story.append(Paragraph(f"Backup Date: {get_nairobi_time().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        sections = [
            ('Orders', data.get('orders', [])),
            ('Products', data.get('products', [])),
            ('Customers', data.get('customers', [])),
            ('Staff', data.get('staff', [])),
            ('Capital Ledger', data.get('capital', []))
        ]
        
        for section_name, section_data in sections:
            story.append(Paragraph(section_name, styles['Heading2']))
            story.append(Paragraph(f"Total Records: {len(section_data)}", styles['Normal']))
            story.append(Spacer(1, 10))
            
            if section_data:
                story.append(Paragraph(f"Sample: {str(section_data[0])[:200]}...", styles['Normal']))
            
            story.append(Spacer(1, 20))
        
        doc.build(story)
        return filepath

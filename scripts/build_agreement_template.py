# Rebuilds src/assets/construction_agreement_template.docx from the user's original Word template.
# The original is only read, never changed.
#   python scripts/build_agreement_template.py "C:/Users/Bernadette Bongar/Documents/Construction_Agreement_Template.docx"
import os, subprocess, sys, tempfile, zipfile

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "src", "assets", "construction_agreement_template.docx")

with tempfile.TemporaryDirectory() as tmp:
    doc_xml = os.path.join(tmp, "document.xml")
    with zipfile.ZipFile(src) as z:
        with open(doc_xml, "wb") as f:
            f.write(z.read("word/document.xml"))
    subprocess.run([sys.executable, os.path.join(here, "tokenize_agreement_template.py"), doc_xml], check=True)
    with open(doc_xml, "rb") as f:
        tokenized = f.read()
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            if info.filename.endswith("/"):
                continue
            zout.writestr(info, tokenized if info.filename == "word/document.xml" else zin.read(info.filename))
print("wrote", os.path.normpath(out))

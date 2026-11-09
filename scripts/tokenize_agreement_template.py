# Turns the user's Construction_Agreement_Template.docx into a docxtemplater template.
# Reads the unpacked original in ./u, writes the tokenized document.xml in place (run on a fresh unpack).
import re, sys

path = sys.argv[1]
x = open(path, encoding="utf8").read()
assert "{" not in re.sub(r"<[^>]+>", "", x), "template text already contains a brace"

spans = list(re.finditer(r"<w:p[ >].*?</w:p>", x, re.S))
paras = [m.group(0) for m in spans]
text = lambda p: "".join(re.findall(r"<w:t(?: [^>]*)?>([^<]*)</w:t>", p))

def find(start, after=0):
    for i in range(after, len(paras)):
        if text(paras[i]).startswith(start):
            return i
    raise SystemExit("paragraph not found: " + start)

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def run(t, rpr=""):
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(t)}</w:t></w:r>'

def ppr(p):
    m = re.search(r"<w:pPr>.*?</w:pPr>", p, re.S)
    return m.group(0) if m else ""

def head(p):
    # opening <w:p ...> tag
    return re.match(r"<w:p[^>]*>", p).group(0)

def set_body(i, *runs):
    """Keep the paragraph's number run + tab run ("1.1" then tab), replace the rest."""
    p = paras[i]
    # the number is the first run; the tab sits either in its own run or at the start of the text run
    m = re.search(r"<w:r[^>]*>(?:<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?(?:<w:lastRenderedPageBreak/>)?<w:t(?: [^>]*)?>[0-9.()a-z]+</w:t></w:r>", p, re.S)
    assert m and "<w:tab/>" in p[m.end():], "no number/tab in paragraph " + text(p)[:20]
    paras[i] = p[: m.end()] + "<w:r><w:tab/></w:r>" + "".join(runs) + "</w:p>"

def tag_para(i, tag):
    """A paragraph holding only a loop/condition tag (docxtemplater paragraphLoop removes it)."""
    return f"{head(paras[i])}{ppr(paras[i])}{run(tag)}</w:p>"

def sub(i, old, new):
    assert old in paras[i], f"{old!r} not in paragraph {text(paras[i])[:40]!r}"
    paras[i] = paras[i].replace(old, new, 1)

BOLD = "<w:rPr><w:b/><w:bCs/></w:rPr>"

# Title line and parties
i = find("[Project Name]"); sub(i, "[Project Name]", "{project_name}"); sub(i, "[Project Location]", "{project_location}")
i = find("[CLIENT NAME], a corporation")
for a, b in [("[CLIENT NAME]", "{client_name}"), ("[Client Address]", "{client_address}"),
             ("[Designation]", "{client_rep_designation}"), ("[NAME OF REPRESENTATIVE]", "{client_rep}")]:
    sub(i, a, b)
i = find("[CONTRACTOR NAME], a ")
for a, b in [("[CONTRACTOR NAME]", "{contractor_name}"), ("[corporation/sole proprietorship]", "{contractor_type}"),
             ("[Contractor Address]", "{contractor_address}"), ("[Designation]", "{contractor_rep_designation}"),
             ("[NAME OF REPRESENTATIVE]", "{contractor_rep}")]:
    sub(i, a, b)

# WHEREAS: "for the construction of [works] at [location]" -> general by type of works
i = find("WHEREAS, the CLIENT is in need")
sub(i, "for the construction of [brief description of the works]", "for {works_phrase}")
sub(i, "[Project Location]", "{project_location}")

# 1.1 opening (keeps the bold defined term "Works" when the wording contains it)
i = find("1.1")
set_body(i, run("{lead_a}"), run("{works_word}", BOLD), run("{lead_b}"))
# Work items: one looped paragraph replaces (a)-(d)
a = find("(a)[Work item 1]")
item = paras[a]
item = item.replace("<w:t>(a)</w:t>", "<w:t>({letter})</w:t>").replace("<w:t>[Work item 1];</w:t>", '<w:t xml:space="preserve">{text}{sep}</w:t>')
assert "{letter}" in item and "{text}" in item
loop_open, loop_close = tag_para(a, "{#items}"), tag_para(a, "{/items}")
for j in (a + 1, a + 2, a + 3):
    assert text(paras[j]).startswith(f"({'bcd'[j - a - 1]})[Work item"), text(paras[j])
paras[a] = loop_open + item + loop_close
paras[a + 1] = paras[a + 2] = paras[a + 3] = ""

set_body(find("1.2"), run("{a12}"))

# Price
i = find("2.1"); sub(i, "[AMOUNT IN WORDS] PESOS", "{price_words}"); sub(i, "[0,000,000.00]", "{price_figures}")
set_body(find("2.3"), run("{a23}"))

# Commencement and completion (duration or dates)
set_body(find("3.1"), run("{a31}"))
set_body(find("3.2"), run("{a32}"))

# Payment
set_body(find("4.1"), run("{dp}"))
i = find("4.2"); set_body(i, run("{billing_first}"))
assert text(paras[i + 1]).startswith("(a)First Billing") and text(paras[i + 2]).startswith("(b)Second Billing")
# Further billing lines reuse the indented (a)/(b) paragraph format, one paragraph per line
b = paras[i + 1]
mb = re.search(r"<w:r[^>]*>(?:<w:rPr>(?:(?!</w:rPr>).)*</w:rPr>)?<w:t(?: [^>]*)?>\(a\)</w:t></w:r>", b, re.S)
assert mb, "billing (a) run"
line_para = b[: mb.start()] + run("{label}") + "<w:r><w:tab/></w:r>" + run("{text}") + "</w:p>"
paras[i + 1] = tag_para(i + 1, "{#billing_lines}") + line_para + tag_para(i + 1, "{/billing_lines}")
paras[i + 2] = ""
sub(find("4.3"), "[__]", "{pay_days}")
set_body(find("4.4"), run("{retention}"))

# Other terms
i = find("5.1"); sub(i, "[one-tenth of one percent (1/10 of 1%)]", "{ld_rate}"); sub(i, "[ten percent (10%)]", "{ld_cap}")
sub(find("5.3"), "[fourteen (14)]", "{takeover_days}")
sub(find("8.1"), "[seven (7)]", "{coca_days}")
sub(find("8.2"), "[twelve (12)]", "{dlp_months}")
sub(find("8.3"), "[seven (7)]", "{coca_days}")
sub(find("9.1"), "[sixty (60)]", "{notice_days}")
sub(find("9.2"), "[fifteen percent (15%)]", "{term_fee}")

# Signature block (table): client | contractor; second client signatory (optional); witnesses
i = find("IN WITNESS WHEREOF")
c = find("[CLIENT NAME]", i); sub(c, "[CLIENT NAME]", "{client_name}")
n = find("[NAME OF SIGNATORY]", c); sub(n, "[NAME OF SIGNATORY]", "{client_signatory}"); sub(n + 1, "[Designation]", "{client_signatory_designation}")
k = find("[CONTRACTOR NAME]", n); sub(k, "[CONTRACTOR NAME]", "{contractor_name}")
n = find("[NAME OF SIGNATORY]", k); sub(n, "[NAME OF SIGNATORY]", "{contractor_signatory}"); sub(n + 1, "[Designation]", "{contractor_signatory_designation}")
n2 = find("[NAME OF SIGNATORY]", n + 1)
line = n2 - 1
assert text(paras[line]).startswith("____"), text(paras[line])
sub(line, "<w:t>", "<w:t>{#has_client2}"); paras[line] = paras[line].replace("</w:t></w:r></w:p>", "{/has_client2}</w:t></w:r></w:p>")
sub(n2, "[NAME OF SIGNATORY]", "{client2_signatory}"); sub(n2 + 1, "[Designation]", "{client2_signatory_designation}")
w = find("Witness", n2); sub(w, ">Witness<", ">{witness1}<")
w = find("Witness", w + 1); sub(w, ">Witness<", ">{witness2}<")

# Rebuild
out, pos = [], 0
for m, p in zip(spans, paras):
    out.append(x[pos:m.start()]); out.append(p); pos = m.end()
out.append(x[pos:])
y = "".join(out)
left = re.findall(r"\[[^\]<]*\]", y)
assert not left, left
open(path, "w", encoding="utf8").write(y)
print("ok", len(re.findall(r"\{[^}<]+\}", y)), "tags")

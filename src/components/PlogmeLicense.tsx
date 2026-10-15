import React from "react";
import { Brand } from "./Brand";
const licence =
  'CRYSNOVAX SOURCE LICENSE\nVersion 1.0\nLicense identifier: Crysnovax Source License v1.0\n\nCopyright (c) 2026 Crysnovax \u2014 @crysnovax/baileys\n\nPreamble\n--------\nThis software is the result of substantial original work by Crysnovax.\nIt is distributed under a restricted license that protects the author\'s\nattribution rights. It is NOT the MIT license and intentionally does\nnot grant the same freedoms.\n\n1. Permitted Use\n   You may use, run, and modify this software for your own personal or\n   non-commercial purposes, including private bot projects, prototypes,\n   and internal tooling, provided that all copyright and attribution\n   notices are preserved.\n\n2. Attribution Requirement\n   Any copy, fork, modified version, or derivative of this software must\n   retain, visibly and unmodified, in the source code, documentation,\n   and any user-facing material (bot menus, footers, README files,\n   sticker pack metadata, etc.):\n     - the original package name, or an explicit credit line reading\n       "Based on @crysnovax/baileys by Crysnovax",\n     - this license text,\n     - the copyright notice above.\n\n3. Prohibited Conduct\n   You may NOT, without the prior written permission of Crysnovax:\n     - rename, rebrand, or republish this software or substantial\n       portions of it under a different name or author,\n     - remove, obscure, or alter any attribution, watermark, integrity\n       check, or branding enforcement contained in the software,\n     - sell, license, sublicense, or commercially redistribute this\n       software or substantial portions of it,\n     - use AI tools, automated rewriting, or any other means to strip\n       attribution and claim the work as your own.\n\n4. Enforcement\n   This software contains integrity and attribution checks. Tampering\n   with, deleting, or circumventing them does not grant you any rights\n   under this license. Violations may be pursued to the fullest extent\n   permitted by law, including copyright claims, DMCA takedowns, and\n   platform (npm, GitHub) abuse reports.\n\n5. No Warranty\n   THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,\n   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF\n   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND\n   NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS\n   BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN\n   ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN\n   CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\n   SOFTWARE.\n\n6. Termination\n   Any violation of this license automatically terminates your rights\n   to use, copy, or modify the software. Upon termination you must\n   delete all copies in your possession.\n';
export function PlogmeLicense() {
  return (
    <main className="info-content" id="main-content">
      <Brand />
      <h1>Plogme attribution and licence.</h1>
      <p>
        Based on @crysnovax/baileys by Crysnovax. Pappy Earning Hub/PappyPay is
        the application, not a claim of authorship or Meta endorsement of the
        underlying library.
      </p>
      <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.8 }}>
        {licence}
      </pre>
      <a className="button" href="#/">
        Back to Pappy
      </a>
    </main>
  );
}

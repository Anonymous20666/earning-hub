import React, { useState } from "react";
import { Copy, RefreshCw, Sparkles } from "lucide-react";
import { send } from "../api";
import type { GrowthRemix } from "../../shared/growthRemix";
type Gallery = {
  quality: string;
  preview: any;
  examples: GrowthRemix[];
  warning: string;
  assetId: string;
  metadataRecordedAt: string;
};
export function GrowthCreativeGallery({ orderId }: { orderId: string }) {
  const [data, setData] = useState<Gallery | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [copied, setCopied] = useState<number | null>(null),
    [fallback, setFallback] = useState(false);
  const generate = async () => {
    setBusy(true);
    setError("");
    setCopied(null);
    try {
      setData(await send(`/growth/${orderId}/creative-preview`, { count: 4 }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="gx-remix" aria-labelledby="gx-remix-heading">
      <div className="gx-list-heading">
        <div>
          <span className="gx-eyebrow">
            DESTINATION URL · GENERATED TYPOGRAPHY
          </span>
          <h4 id="gx-remix-heading">A fresh look for every group.</h4>
        </div>
        <Sparkles size={21} />
      </div>
      <p className="gx-muted">
        Real destination preview, generated name decoration, unchanged clickable
        URL. Layouts, ornaments, Unicode lettering, native status fonts and
        backgrounds are mixed—not an advertiser-written caption. These examples
        do not queue or send a post.
      </p>
      <div className="gx-inline-actions">
        <button
          className="gx-button secondary"
          disabled={busy}
          onClick={generate}
        >
          <RefreshCw size={16} />
          {busy
            ? "Preparing real preview…"
            : data
              ? "Generate more remixes"
              : "Generate URL remixes"}
        </button>
        {data && (
          <label className="gx-check">
            <input
              type="checkbox"
              checked={fallback}
              onChange={(e) => {
                setFallback(e.target.checked);
                setCopied(null);
              }}
            />
            Readable text fallback
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="gx-alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="gx-muted" role="status">
            {data.warning} Metadata snapshot:{" "}
            {new Date(data.metadataRecordedAt).toLocaleString()}.
          </p>
          <div className="gx-remix-grid">
            {data.examples.map((c, i) => (
              <article
                className="gx-remix-option"
                key={c.styleIndex}
                aria-label={`Generated URL design ${i + 1}`}
              >
                <div
                  className="gx-remix-stage"
                  style={{ background: c.backgroundColor }}
                >
                  <div className="gx-remix-card">
                    {data.quality === "COMPLETE" &&
                    data.preview.thumbnailBase64 ? (
                      <img
                        src={
                          "data:image/jpeg;base64," +
                          data.preview.thumbnailBase64
                        }
                        alt="Destination’s real preview"
                        loading="lazy"
                      />
                    ) : (
                      <p className="gx-remix-missing">
                        No complete preview image available
                      </p>
                    )}
                    <div>
                      <strong>{data.preview.title || c.destinationName}</strong>
                      {data.preview.description && (
                        <p>{data.preview.description}</p>
                      )}
                      <small>{new URL(c.destination).hostname}</small>
                    </div>
                  </div>
                  <div
                    className="gx-remix-text"
                    style={{
                      fontFamily: `"Pappy Math", ${c.nativeFont === 2 ? "cursive" : c.nativeFont === 1 || c.nativeFont === 8 ? "Georgia,serif" : "system-ui,sans-serif"}`,
                      fontWeight:
                        c.nativeFont === 6 || c.nativeFont === 9 ? 700 : 500,
                    }}
                  >
                    {(fallback ? c.plainText : c.text)
                      .split("\n")
                      .map((line, index) => (
                        <div key={index}>
                          {line === c.destination ? (
                            <a
                              href={c.destination}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {line}
                            </a>
                          ) : (
                            line
                          )}
                        </div>
                      ))}
                  </div>
                </div>
                <div className="gx-remix-caption">
                  <div>
                    <strong>Design {i + 1}</strong>
                    <small>
                      {fallback
                        ? "Readable fallback"
                        : c.typography.replaceAll("-", " ")}{" "}
                      · native {fallback ? "System" : c.nativeFontName}
                    </small>
                  </div>
                  <button
                    className="gx-button secondary small"
                    aria-label={`Copy generated URL text ${i + 1}`}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          fallback ? c.plainText : c.text,
                        );
                        setCopied(i);
                        setError("");
                      } catch {
                        setError(
                          "Copy is unavailable in this browser. Select the visible text instead.",
                        );
                      }
                    }}
                  >
                    <Copy size={14} />
                    {copied === i ? "Copied" : "Copy text"}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="gx-muted">
            Browser approximation, not a WhatsApp screenshot. Font glyphs, card
            layout and cropping can differ by device. These are newly generated
            previews; the funded planner must freeze each group’s chosen
            creative before any eventual send. Colours and native fonts apply to
            status posts; ordinary group chat uses decorated Unicode text and the
            original link preview. Copy includes text only, not a preview image or
            native font settings.
          </p>
        </>
      )}
    </section>
  );
}

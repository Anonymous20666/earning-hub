import { RichLinkPreview } from '../types';

export class LinkPreviewEngine {
  /**
   * Generates a 4-character anti-ban spin tag (e.g., "\n\n_Ref: #8F2A_")
   * Ensures no two broadcast messages have an identical byte-for-byte SHA hash.
   */
  public static generateAntiBanSpinTag(): string {
    const chars = '0123456789ABCDEF';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `\n\n_Ref: #${code}_`;
  }

  /**
   * Pre-Flight Rich Link Preview Builder
   * Checks for chat.whatsapp.com invite codes or external URLs
   */
  public static buildRichLinkPreview(url: string, customTitle?: string, customDesc?: string): RichLinkPreview {
    if (!url || !url.startsWith('http')) {
      throw new Error('Mandatory Rich Link Preview Error: Every broadcast MUST contain a valid HTTP/HTTPS URL.');
    }

    const waInviteRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/i;
    const match = url.match(waInviteRegex);

    if (match) {
      const inviteCode = match[1];
      // Simulated native Baileys / plogme sock.groupGetInviteInfo(code) result
      const simulatedMemberCount = Math.floor(Math.random() * 650) + 120;
      return {
        url,
        title: customTitle || `WhatsApp Group: Active Community (#${inviteCode.slice(0, 5)})`,
        description: customDesc || `Join our verified community with ${simulatedMemberCount} active members. Tap to accept invite.`,
        sourceUrl: url,
        isWaGroupInvite: true,
        memberCount: simulatedMemberCount,
        // High quality preview banner representation
        jpegThumbnailBase64: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%2306070A"/><circle cx="150" cy="100" r="50" fill="%2310B981" opacity="0.3"/><text x="150" y="105" fill="%2310B981" font-size="16" text-anchor="middle" font-family="sans-serif">WHATSAPP GROUP</text></svg>',
      };
    }

    // External OpenGraph scraping format
    const domain = new URL(url).hostname;
    return {
      url,
      title: customTitle || `${domain} — Official Portal & Channel`,
      description: customDesc || `Discover verified updates, exclusive promotions, and fast-track access directly via ${domain}.`,
      sourceUrl: url,
      isWaGroupInvite: false,
      jpegThumbnailBase64: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%2306070A"/><rect x="20" y="20" width="260" height="160" rx="12" fill="%2306B6D4" opacity="0.15"/><text x="150" y="105" fill="%2306B6D4" font-size="16" text-anchor="middle" font-family="sans-serif">OFFICIAL LINK</text></svg>',
    };
  }

  /**
   * Builds the plogme contextInfo payload with externalAdReply
   * Ensures Image, Video, Audio, and Text broadcasts render massive clickable cards.
   */
  public static buildExternalAdReply(preview: RichLinkPreview) {
    return {
      title: preview.title,
      body: preview.description,
      mediaType: 1, // standard link card
      renderLargerThumbnail: true,
      sourceUrl: preview.url,
      thumbnailUrl: preview.jpegThumbnailBase64,
    };
  }
}

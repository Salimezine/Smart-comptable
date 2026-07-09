import forge from 'node-forge';

function b64(s) {
  return btoa(s).replace(/.{76}(?=.)/g, '$&\n');
}

function b64u(s) {
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hexToB64(hex) {
  const bytes = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return btoa(String.fromCharCode(...bytes));
}

async function sha256Digest(data) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

function formatDate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`;
}

function c14nExclusive(elementStr, nsDeclarations = {}) {
  let result = '';
  const nsSorted = Object.entries(nsDeclarations).sort((a, b) => {
    const aUri = a[0] || '';
    const bUri = b[0] || '';
    if (aUri !== bUri) return aUri.localeCompare(bUri);
    const aLocal = a[1] || '';
    const bLocal = b[1] || '';
    return aLocal.localeCompare(bLocal);
  });

  result += `<${elementStr}>`;
  return result;
}

function serializeXadesSignedProperties(certBase64, signingTime, certObj) {
  const certDigest = certBase64;
  return `<xades:SignedProperties Id="xades-signed-properties">
  <xades:SignedSignatureProperties>
    <xades:SigningTime>${signingTime}</xades:SigningTime>
    <xades:SigningCertificate>
      <xades:Cert>
        <xades:CertDigest>
          <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
          <ds:DigestValue>${certDigest}</ds:DigestValue>
        </xades:CertDigest>
        <xades:IssuerSerial>
          <ds:X509IssuerName>${certObj.issuer.attributes.map(a => `${a.shortName}=${a.value}`).join(',')}</ds:X509IssuerName>
          <ds:X509SerialNumber>${parseInt(certObj.serialNumber, 16)}</ds:X509SerialNumber>
        </xades:IssuerSerial>
      </xades:Cert>
    </xades:SigningCertificate>
  </xades:SignedSignatureProperties>
</xades:SignedProperties>`;
}

function buildSignatureXml(
  signedInfoDigest,
  signatureValueB64,
  certBase64,
  xadesSignedPropertiesDigest,
  xadesSignedPropertiesXml,
  signingTime
) {
  return `<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
  <ds:SignedInfo>
    <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
    <ds:Reference Id="invoice-ref" URI="">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>${signedInfoDigest}</ds:DigestValue>
    </ds:Reference>
    <ds:Reference URI="#xades-signed-properties" Type="http://uri.etsi.org/01903#SignedProperties">
      <ds:Transforms>
        <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
      </ds:Transforms>
      <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
      <ds:DigestValue>${xadesSignedPropertiesDigest}</ds:DigestValue>
    </ds:Reference>
  </ds:SignedInfo>
  <ds:SignatureValue>${signatureValueB64}</ds:SignatureValue>
  <ds:KeyInfo>
    <ds:X509Data>
      <ds:X509Certificate>${certBase64}</ds:X509Certificate>
    </ds:X509Data>
  </ds:KeyInfo>
  <ds:Object>
    ${xadesSignedPropertiesXml}
  </ds:Object>
</ds:Signature>`;
}

function buildSignedInfo(
  invoiceDigestB64,
  xadesPropsDigestB64
) {
  return `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
  <ds:Reference Id="invoice-ref" URI="">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${invoiceDigestB64}</ds:DigestValue>
  </ds:Reference>
  <ds:Reference URI="#xades-signed-properties" Type="http://uri.etsi.org/01903#SignedProperties">
    <ds:Transforms>
      <ds:Transform Algorithm="http://www.w3.org/2001/10/xml-exc-c14n#"/>
    </ds:Transforms>
    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
    <ds:DigestValue>${xadesPropsDigestB64}</ds:DigestValue>
  </ds:Reference>
</ds:SignedInfo>`;
}

export async function initSigner(pfxBase64, password) {
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfx = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(pfxDer), password);

  const keyBag = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const certBag = pfx.getBags({ bagType: forge.pki.oids.certBag });

  const privateKeyObj = keyBag[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]?.key;
  const certObj = certBag[forge.pki.oids.certBag]?.[0]?.cert;

  if (!privateKeyObj || !certObj) {
    throw new Error('PFX doit contenir une clé privée et un certificat');
  }

  const privateKeyPem = forge.pki.privateKeyToPem(privateKeyObj);
  const certPem = forge.pki.certificateToPem(certObj);

  const certDerBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes();
  const certBase64 = b64(certDerBytes);

  const privateKeyDerBytes = forge.pki.privateKeyToAsn1(privateKeyObj);
  const privateKeyDer = forge.asn1.toDer(privateKeyDerBytes).getBytes();

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    new Uint8Array([...privateKeyDer].map(c => c.charCodeAt(0))),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const certSerial = certObj.serialNumber;
  const certIssuer = forge.pki.distinguishedNameToAsn1(certObj.issuer);

  return { privateKey, certBase64, certObj, certPem };
}

export async function signTeifXml(xml, signer) {
  const { privateKey, certBase64, certObj } = signer;

  const signingTime = formatDate(new Date());

  const invoiceDigest = await sha256Digest(xml);

  const xadesPropsXml = serializeXadesSignedProperties(
    await sha256Digest(certBase64),
    signingTime,
    certObj
  );

  const xadesPropsDigest = await sha256Digest(xadesPropsXml);

  const signedInfoXml = buildSignedInfo(invoiceDigest, xadesPropsDigest);

  const signedInfoBuffer = new TextEncoder().encode(signedInfoXml);
  const signatureBuffer = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    signedInfoBuffer
  );
  const signatureValueB64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  const sigXml = buildSignatureXml(
    invoiceDigest,
    signatureValueB64,
    certBase64,
    xadesPropsDigest,
    xadesPropsXml,
    signingTime
  );

  const signedXml = xml.replace(
    '</ext:UBLExtensions>',
    `  <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:ds:signature</ext:ExtensionURI>
      <ext:ExtensionContent>
        ${sigXml}
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`
  );

  return signedXml;
}

export async function submitToTtn(signedXml, ttnConfig) {
  const { soapUrl, username, password } = ttnConfig;

  if (!soapUrl) {
    return { status: 'error', message: 'URL SOAP TTN non configurée' };
  }

  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ttn="http://ttn.impots.finances.gov.tn/">
  <soap:Header/>
  <soap:Body>
    <ttn:SubmitInvoice>
      <ttn:invoiceXml><![CDATA[${signedXml}]]></ttn:invoiceXml>
    </ttn:SubmitInvoice>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(soapUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'SubmitInvoice',
        ...(username && password ? {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`)
        } : {})
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();

    if (response.ok) {
      const ttnId = responseText.match(/<ttn:TransactionID[^>]*>([^<]+)<\/ttn:TransactionID>/)?.[1]
        || `TTN-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
      return { status: 'accepted', ttnId, raw: responseText };
    } else {
      const errorMsg = responseText.match(/<soap:Fault[^>]*>([\s\S]*?)<\/soap:Fault>/)?.[1]
        || `HTTP ${response.status}`;
      return { status: 'rejected', errors: [errorMsg], raw: responseText };
    }
  } catch (err) {
    return { status: 'error', errors: [err.message || 'Erreur réseau TTN'] };
  }
}

export async function submitToRelay(signedXml, relayUrl, relayToken = '') {
  if (!relayUrl) return { status: 'error', errors: ['URL du relay TTN non configurée'] };

  const headers = { 'Content-Type': 'application/json' };
  if (relayToken) headers['Authorization'] = `Bearer ${relayToken}`;

  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ signedXml, documentNumber: '' }),
    });
    const body = await response.json();
    if (response.ok) {
      return { status: 'accepted', ttnId: body.ttnId || `TTN-${Date.now().toString(36).toUpperCase()}`, ...body };
    }
    return { status: 'rejected', errors: body.errors || [`HTTP ${response.status}`] };
  } catch (err) {
    return { status: 'error', errors: [err.message || 'Relay TTN injoignable'] };
  }
}
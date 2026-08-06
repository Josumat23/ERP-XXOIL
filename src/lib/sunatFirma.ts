import * as forge from "node-forge";
import { SignedXml } from "xml-crypto";

// ---------------------------------------------------------------------------
// Firma digital XMLDSig del XML UBL, requisito de SUNAT para todo comprobante
// electrónico enviado por SEE - Del Contribuyente. NO fue probado contra un
// certificado real de una entidad certificadora acreditada ni verificado por
// el ambiente beta de SUNAT — antes de usar en producción, confirmar que el
// algoritmo de firma (RSA-SHA1, histórico en UBL Perú) sigue siendo el
// exigido, o si SUNAT ya requiere RSA-SHA256 para certificados nuevos.
// ---------------------------------------------------------------------------

// Extrae la clave privada y el certificado de un .pfx/.p12 (PKCS#12).
function extraerClaveYCertificado(
  certificadoBase64: string,
  password: string
): { privateKeyPem: string; certificatePem: string } {
  const pfxDer = forge.util.decode64(certificadoBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  let privateKey: forge.pki.PrivateKey | null = null;
  let certificate: forge.pki.Certificate | null = null;

  for (const safeContents of pfx.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (
        (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag || safeBag.type === forge.pki.oids.keyBag) &&
        safeBag.key
      ) {
        privateKey = safeBag.key;
      }
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certificate = safeBag.cert;
      }
    }
  }

  if (!privateKey || !certificate) {
    throw new Error(
      "El certificado .pfx/.p12 no contiene una clave privada y un certificado válidos (¿contraseña incorrecta?)."
    );
  }

  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(certificate),
  };
}

// Firma el XML completo (enveloped signature) e inserta el nodo
// <ds:Signature> dentro de <ext:UBLExtensions>/<ext:UBLExtension>/
// <ext:ExtensionContent> — la ubicación que SUNAT exige para todo documento
// UBL, distinta del nodo que efectivamente se firma (el documento completo).
export function firmarXml(xmlSinFirmar: string, certificadoBase64: string, password: string): string {
  const { privateKeyPem, certificatePem } = extraerClaveYCertificado(certificadoBase64, password);

  const firma = new SignedXml({
    privateKey: privateKeyPem,
    publicCert: certificatePem,
    signatureAlgorithm: "http://www.w3.org/2000/09/xmldsig#rsa-sha1",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  });

  firma.addReference({
    xpath: "/*",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
    digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
    isEmptyUri: true,
  });

  firma.computeSignature(xmlSinFirmar, {
    prefix: "ds",
    location: { reference: "//*[local-name(.)='ExtensionContent']", action: "append" },
  });

  return firma.getSignedXml();
}

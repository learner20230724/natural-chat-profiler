import { Router } from 'express';
import { SessionService } from '../services/SessionService';
import { PDFService } from '../services/PDFService';
import { PrivacyEventRepository } from '../infrastructure/repositories/PrivacyEventRepository';
import { asyncHandler } from '../shared/http';

export default function createExportRouter(
  sessionService: SessionService,
  pdfService: PDFService,
  privacyEvents: PrivacyEventRepository
) {
  const router = Router();

  router.get(
    '/:sessionId/export/pdf',
    asyncHandler(async (req, res) => {
      const detail = await sessionService.getSession(req.params.sessionId);
      const pdfBuffer = await pdfService.generatePDF(detail.session, detail.profile);

      await privacyEvents.create({
        sessionId: req.params.sessionId,
        eventType: 'export_pdf',
        metadata: { format: 'pdf' },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="profile-${req.params.sessionId}.pdf"`
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    })
  );

  router.delete(
    '/:sessionId/data',
    asyncHandler(async (req, res) => {
      await sessionService.deleteSession(req.params.sessionId);
      res.json({ success: true, data: { sessionId: req.params.sessionId }, error: null });
    })
  );

  return router;
}

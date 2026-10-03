import { noticeService } from './noticeService';
import { requestService } from './requestService';
import { complaintService } from './complaintService';
import { gatePassService } from './gatePassService';
import { certificateService } from './certificateService';
import { calendarService } from './calendarService';
import { lostFoundService } from './lostFoundService';
import { directoryService } from './directoryService';
import { faqService } from './faqService';
import { pollService } from './pollService';
import type { UserRecord } from '../types';

export interface SearchResultItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type:
    | 'notice'
    | 'request'
    | 'complaint'
    | 'gate_pass'
    | 'certificate'
    | 'calendar'
    | 'lost_found'
    | 'service'
    | 'faq'
    | 'poll';
  link: string;
  status?: string;
  timestamp?: string;
}

export const searchService = {
  async performUniversalSearch(query: string, user: UserRecord | null): Promise<SearchResultItem[]> {
    if (!query || query.trim().length === 0) return [];
    const q = query.trim().toLowerCase();

    const results: SearchResultItem[] = [];

    // Parallel fetch with error boundaries
    const [
      noticesRes,
      calendarRes,
      lostFoundRes,
      directoryRes,
      faqRes,
      pollsRes,
      requestsRes,
      complaintsRes,
      passesRes,
      certsRes,
    ] = await Promise.allSettled([
      noticeService.getNotices(user),
      calendarService.getEvents(),
      lostFoundService.getItems(),
      directoryService.getServices(),
      faqService.getFAQs(),
      pollService.getPolls(),
      // Scoped user records
      user?.role === 'STUDENT'
        ? requestService.getStudentRequests(user.studentId || user.uid)
        : user?.role === 'MAIN_ADMIN' || user?.permissions?.includes('MANAGE_REQUESTS')
        ? requestService.getAllRequests()
        : Promise.resolve([]),
      user?.role === 'STUDENT'
        ? complaintService.getComplaints({ studentId: user.uid })
        : user?.role === 'MAIN_ADMIN' || user?.permissions?.includes('MANAGE_COMPLAINTS')
        ? complaintService.getComplaints()
        : Promise.resolve([]),
      user?.role === 'STUDENT'
        ? gatePassService.getPasses({ studentId: user.uid })
        : user?.role === 'MAIN_ADMIN' || user?.permissions?.includes('MANAGE_GATE_PASS')
        ? gatePassService.getPasses()
        : Promise.resolve([]),
      user?.role === 'STUDENT'
        ? certificateService.getStudentCertificates(user.studentId || user.uid)
        : user?.role === 'MAIN_ADMIN' || user?.permissions?.includes('MANAGE_CERTIFICATES')
        ? certificateService.getAllCertificates()
        : Promise.resolve([]),
    ]);

    // 1. Notices
    if (noticesRes.status === 'fulfilled') {
      noticesRes.value.forEach((n) => {
        if (
          n.title.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q) ||
          n.priority.toLowerCase().includes(q)
        ) {
          results.push({
            id: n.id,
            title: n.title,
            description: n.description.substring(0, 120) + '...',
            category: n.category,
            type: 'notice',
            link: '/notices',
            status: n.priority,
            timestamp: n.publishDate,
          });
        }
      });
    }

    // 2. Calendar Events
    if (calendarRes.status === 'fulfilled') {
      calendarRes.value.forEach((ev) => {
        if (
          ev.title.toLowerCase().includes(q) ||
          ev.description.toLowerCase().includes(q) ||
          ev.category.toLowerCase().includes(q) ||
          (ev.location && ev.location.toLowerCase().includes(q))
        ) {
          results.push({
            id: ev.id,
            title: ev.title,
            description: `${ev.category.toUpperCase()} • ${ev.location || 'Campus'} • ${ev.description.substring(0, 100)}...`,
            category: ev.category,
            type: 'calendar',
            link: '/calendar',
            timestamp: ev.startDate,
          });
        }
      });
    }

    // 3. Lost & Found
    if (lostFoundRes.status === 'fulfilled') {
      lostFoundRes.value.forEach((item) => {
        if (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        ) {
          results.push({
            id: item.id,
            title: `[${item.type}] ${item.title}`,
            description: `${item.location} • ${item.description.substring(0, 100)}...`,
            category: item.category,
            type: 'lost_found',
            link: '/lost-found',
            status: item.status,
            timestamp: item.date,
          });
        }
      });
    }

    // 4. Service Directory
    if (directoryRes.status === 'fulfilled') {
      directoryRes.value.forEach((srv) => {
        if (
          srv.department.toLowerCase().includes(q) ||
          srv.responsibleOffice.toLowerCase().includes(q) ||
          srv.location.toLowerCase().includes(q) ||
          srv.servicesProvided.some((s) => s.toLowerCase().includes(q))
        ) {
          results.push({
            id: srv.id,
            title: srv.responsibleOffice,
            description: `${srv.department} • Location: ${srv.location} • Hours: ${srv.workingHours}`,
            category: srv.department,
            type: 'service',
            link: '/services',
          });
        }
      });
    }

    // 5. Help Center FAQs
    if (faqRes.status === 'fulfilled') {
      faqRes.value.forEach((f) => {
        if (
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
        ) {
          results.push({
            id: f.id,
            title: f.question,
            description: f.answer.substring(0, 140) + '...',
            category: f.category,
            type: 'faq',
            link: '/help',
          });
        }
      });
    }

    // 6. Campus Polls
    if (pollsRes.status === 'fulfilled') {
      pollsRes.value.forEach((poll) => {
        if (
          poll.title.toLowerCase().includes(q) ||
          poll.description.toLowerCase().includes(q) ||
          (poll.question && poll.question.toLowerCase().includes(q))
        ) {
          results.push({
            id: poll.id,
            title: poll.title,
            description: poll.description.substring(0, 120) + '...',
            category: 'Campus Poll',
            type: 'poll',
            link: '/polls',
            status: poll.status,
          });
        }
      });
    }

    // 7. Requests (Role-Scoped)
    if (requestsRes.status === 'fulfilled') {
      requestsRes.value.forEach((req) => {
        if (
          req.title.toLowerCase().includes(q) ||
          req.description.toLowerCase().includes(q) ||
          req.requestId.toLowerCase().includes(q) ||
          req.requestType.toLowerCase().includes(q) ||
          req.studentName.toLowerCase().includes(q)
        ) {
          results.push({
            id: req.id,
            title: `${req.title} (#${req.requestId})`,
            description: `${req.studentName} (${req.department}) • Status: ${req.status}`,
            category: req.requestType.replace('_', ' '),
            type: 'request',
            link: user?.role === 'STUDENT' ? '/student/requests' : '/requests',
            status: req.status,
            timestamp: req.submittedAt,
          });
        }
      });
    }

    // 8. Complaints (Role-Scoped)
    if (complaintsRes.status === 'fulfilled') {
      complaintsRes.value.forEach((cmp) => {
        if (
          cmp.title.toLowerCase().includes(q) ||
          cmp.description.toLowerCase().includes(q) ||
          cmp.complaintId.toLowerCase().includes(q) ||
          cmp.category.toLowerCase().includes(q) ||
          cmp.location.toLowerCase().includes(q)
        ) {
          results.push({
            id: cmp.id,
            title: `${cmp.title} (#${cmp.complaintId})`,
            description: `${cmp.category} • ${cmp.location} • Status: ${cmp.status}`,
            category: cmp.category,
            type: 'complaint',
            link: '/complaints',
            status: cmp.status,
            timestamp: cmp.submittedAt,
          });
        }
      });
    }

    // 9. Gate Passes (Role-Scoped)
    if (passesRes.status === 'fulfilled') {
      passesRes.value.forEach((gp: any) => {
        const passNum = gp.passNumber || gp.gatePassId || gp.id;
        if (
          (passNum && passNum.toLowerCase().includes(q)) ||
          (gp.destination && gp.destination.toLowerCase().includes(q)) ||
          (gp.reason && gp.reason.toLowerCase().includes(q)) ||
          (gp.studentName && gp.studentName.toLowerCase().includes(q))
        ) {
          results.push({
            id: gp.id,
            title: `Gate Pass #${passNum} (${gp.studentName || 'Student'})`,
            description: `Destination: ${gp.destination} • Reason: ${gp.reason} • Status: ${gp.status}`,
            category: gp.category || 'Gate Pass',
            type: 'gate_pass',
            link: user?.role === 'STUDENT' ? '/student/gate-pass' : '/gate-pass',
            status: gp.status,
            timestamp: gp.appliedAt || gp.leavingDate,
          });
        }
      });
    }

    // 10. Certificates (Role-Scoped)
    if (certsRes.status === 'fulfilled') {
      certsRes.value.forEach((cert: any) => {
        if (
          cert.certificateId.toLowerCase().includes(q) ||
          cert.certificateType.toLowerCase().includes(q) ||
          cert.studentName.toLowerCase().includes(q) ||
          cert.studentRoll.toLowerCase().includes(q)
        ) {
          results.push({
            id: cert.id,
            title: `${cert.certificateType} (#${cert.certificateId})`,
            description: `Issued to ${cert.studentName} (${cert.studentRoll}) on ${new Date(cert.issueDate).toLocaleDateString()}`,
            category: cert.certificateType,
            type: 'certificate',
            link: user?.role === 'STUDENT' ? '/student/certificates' : '/certificates',
            status: cert.status,
            timestamp: cert.issueDate,
          });
        }
      });
    }

    return results;
  },
};

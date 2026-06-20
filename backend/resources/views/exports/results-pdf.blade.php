<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Exam Results — {{ $exam->course?->code }}</title>
<style>
  body { font-family: DejaVu Sans, sans-serif; font-size: 12px; color: #1e293b; margin: 0; padding: 0; }
  .header { background: #1e40af; color: white; padding: 16px 24px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header p { margin: 4px 0 0; font-size: 11px; opacity: 0.85; }
  .meta { padding: 12px 24px; background: #f1f5f9; border-bottom: 1px solid #cbd5e1; display: flex; gap: 24px; }
  .meta span { font-size: 11px; color: #475569; }
  .meta b { color: #1e293b; }
  .content { padding: 16px 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { background: #e2e8f0; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; }
  td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
  tr:last-child td { border-bottom: none; }
  .grade { display: inline-block; font-weight: bold; }
  .grade-A { color: #16a34a; }
  .grade-B { color: #2563eb; }
  .grade-C { color: #d97706; }
  .grade-F { color: #dc2626; }
  .absent { color: #94a3b8; font-style: italic; }
  .footer { padding: 12px 24px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: right; }
  .stat { font-size: 13px; font-weight: bold; }
</style>
</head>
<body>

<div class="header">
  <h1>Exam Results &mdash; {{ $exam->course?->title }}</h1>
  <p>{{ $exam->course?->code }} &nbsp;|&nbsp; {{ $exam->session }} &nbsp;|&nbsp; {{ ucfirst($exam->semester->value) }} Semester</p>
</div>

<div class="meta">
  <span>Date: <b>{{ $exam->exam_date->format('d M Y') }}</b></span>
  <span>Duration: <b>{{ $exam->duration_minutes }} min</b></span>
  <span>Students: <b>{{ $results->count() }}</b></span>
  <span>Average: <b>{{ number_format($results->avg('percentage'), 1) }}%</b></span>
  <span>Pass rate: <b>{{ number_format($results->where('grade', '!=', 'F')->count() / max($results->count(), 1) * 100, 1) }}%</b></span>
</div>

<div class="content">
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Matric Number</th>
        <th>Full Name</th>
        <th>Score</th>
        <th>Total</th>
        <th>%</th>
        <th>Grade</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      @foreach($results as $i => $r)
      <tr>
        <td>{{ $i + 1 }}</td>
        <td>{{ $r->student?->matric_number ?? '—' }}</td>
        <td>{{ $r->student?->full_name ?? '—' }}</td>
        @if($r->is_absent)
          <td colspan="4" class="absent">Absent</td>
          <td class="absent">ABS</td>
        @else
          <td>{{ number_format((float) $r->total_score, 1) }}</td>
          <td>{{ number_format((float) $r->total_marks, 1) }}</td>
          <td>{{ number_format((float) $r->percentage, 1) }}%</td>
          <td><span class="grade grade-{{ $r->grade[0] ?? 'F' }}">{{ $r->grade }}</span></td>
        @endif
        <td>{{ $r->is_absent ? 'Absent' : 'Present' }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>
</div>

<div class="footer">
  Generated {{ now()->format('d M Y H:i') }} &nbsp;&bull;&nbsp; CBT System
</div>
</body>
</html>

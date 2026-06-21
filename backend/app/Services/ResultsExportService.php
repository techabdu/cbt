<?php

namespace App\Services;

use App\Models\Exam;
use App\Models\ExamResult;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ResultsExportService
{
    /**
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function exportPdf(Exam $exam): mixed
    {
        $results = $this->loadResults($exam);
        $pdf = Pdf::loadView('exports.results-pdf', compact('exam', 'results'));
        $filename = $this->filename($exam, 'pdf');

        return $pdf->download($filename);
    }

    /**
     * @return \Symfony\Component\HttpFoundation\BinaryFileResponse
     */
    public function exportExcel(Exam $exam): mixed
    {
        $results  = $this->loadResults($exam);
        $filename = $this->filename($exam, 'xlsx');
        $export   = new ResultsExcelExport($exam, $results);

        return Excel::download($export, $filename);
    }

    private function loadResults(Exam $exam): Collection
    {
        $exam->loadMissing('course');

        return ExamResult::with('student')
            ->where('exam_id', $exam->id)
            ->orderBy('percentage', 'desc')
            ->get();
    }

    private function filename(Exam $exam, string $ext): string
    {
        $code = $exam->course?->code ?? 'exam-'.$exam->id;

        // The session ("2024/2025") contains a slash, which is illegal in a
        // Content-Disposition filename and would otherwise throw when the
        // download response is built. Normalise it to a dash, then slugify the
        // whole stem so the filename is safe and readable.
        $session = str_replace('/', '-', (string) $exam->session);

        return str($code.'-results-'.$session)->slug()->append('.'.$ext)->value();
    }
}

/**
 * Internal class — only used by ResultsExportService.
 */
class ResultsExcelExport implements FromCollection, WithHeadings, WithStyles
{
    public function __construct(
        private readonly Exam $exam,
        private readonly Collection $results,
    ) {}

    public function collection(): Collection
    {
        return $this->results->map(fn (ExamResult $r, int $i) => [
            $i + 1,
            $r->student?->matric_number ?? '—',
            $r->student?->full_name ?? '—',
            $r->total_score,
            $r->total_marks,
            number_format((float) $r->percentage, 1).'%',
            $r->grade,
            $r->is_absent ? 'Absent' : 'Present',
        ]);
    }

    /** @return array<int, string> */
    public function headings(): array
    {
        $course = $this->exam->course;
        return [
            '#',
            'Matric Number',
            'Full Name',
            'Score',
            "Total ({$course?->credit_units} units)",
            'Percentage',
            'Grade',
            'Attendance',
        ];
    }

    public function styles(Worksheet $sheet): void
    {
        $sheet->getStyle('A1:H1')->getFont()->setBold(true);
        $sheet->getStyle('A1:H1')->getFill()
            ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
            ->getStartColor()->setRGB('E2E8F0');
    }
}

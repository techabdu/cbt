<?php

namespace App\Http\Requests\ExamOfficer;

use App\Enums\Semester;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignStudentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'student_ids'   => ['required', 'array', 'min:1'],
            'student_ids.*' => ['integer',
                Rule::exists('students', 'id')->where('school_id', $schoolId)],
            'session'       => ['required', 'string', 'regex:/^\d{4}\/\d{4}$/'],
            'semester'      => ['required', Rule::enum(Semester::class)],
        ];
    }
}

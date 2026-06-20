<?php

namespace App\Http\Requests\ExamOfficer;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignStudentsToCombinationRequest extends FormRequest
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
        ];
    }
}

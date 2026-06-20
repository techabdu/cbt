<?php

namespace App\Http\Requests\ExamOfficer;

use App\Enums\StudentLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId  = $this->attributes->get('school_id');
        $studentId = $this->route('student')?->id;

        return [
            'matric_number' => ['required', 'string', 'max:50',
                Rule::unique('students', 'matric_number')->ignore($studentId)],
            'full_name'     => ['required', 'string', 'max:255'],
            'department_id' => ['required', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
            'level'         => ['required', Rule::enum(StudentLevel::class)],
            'is_active'     => ['sometimes', 'boolean'],
        ];
    }
}

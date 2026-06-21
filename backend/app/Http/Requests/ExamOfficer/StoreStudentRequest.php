<?php

namespace App\Http\Requests\ExamOfficer;

use App\Enums\StudentLevel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $schoolId = $this->attributes->get('school_id');

        return [
            'matric_number' => ['required', 'string', 'max:50', Rule::unique('students', 'matric_number')],
            'full_name'     => ['required', 'string', 'max:255'],
            'level'         => ['required', Rule::enum(StudentLevel::class)],
            // The canonical program link — may be assigned now or later.
            'combination_id' => ['nullable', 'integer',
                Rule::exists('combinations', 'id')->where('school_id', $schoolId)],
            // Optional "home/registering" department.
            'department_id' => ['nullable', 'integer',
                Rule::exists('departments', 'id')->where('school_id', $schoolId)],
        ];
    }
}
